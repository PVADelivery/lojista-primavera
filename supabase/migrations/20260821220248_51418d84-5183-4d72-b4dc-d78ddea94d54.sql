-- ============================================================
-- 1) WALLETS: impedir que o próprio usuário altere o saldo
-- ============================================================

-- Política de UPDATE passa a ser exclusiva de administradores
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
CREATE POLICY wallets_update_admin_only ON public.wallets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trava em nível de banco: saldo só muda via rotinas do servidor (SECURITY DEFINER),
-- service_role ou administrador autenticado
CREATE OR REPLACE FUNCTION public.prevent_wallet_balance_tampering()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance
     AND current_user IN ('anon', 'authenticated')
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Saldo da carteira só pode ser alterado por administradores ou rotinas do servidor'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_balance_guard ON public.wallets;
CREATE TRIGGER trg_wallet_balance_guard
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_balance_tampering();

-- Rotina oficial de saque: valida saldo com trava (FOR UPDATE), desconta e registra
CREATE OR REPLACE FUNCTION public.request_wallet_withdrawal(_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_withdrawal_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  SELECT balance INTO v_balance
    FROM public.wallets
   WHERE user_id = auth.uid()
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  IF v_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE', 'balance', v_balance);
  END IF;

  UPDATE public.wallets
     SET balance = balance - _amount,
         updated_at = now()
   WHERE user_id = auth.uid();

  INSERT INTO public.withdrawals (user_id, amount, status)
  VALUES (auth.uid(), _amount, 'pending')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.financial_transactions (user_id, type, amount, description, related_id)
  VALUES (auth.uid(), 'withdrawal', -_amount, 'Solicitação de saque', v_withdrawal_id);

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_wallet_withdrawal(numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_wallet_withdrawal(numeric) TO authenticated;

-- ============================================================
-- 2) DELIVERIES: impedir alteração de campos financeiros
--    por lojistas/entregadores fora das rotinas oficiais
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_delivery_financial_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.value IS DISTINCT FROM OLD.value
       OR NEW.commission IS DISTINCT FROM OLD.commission
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.order_value IS DISTINCT FROM OLD.order_value
       OR NEW.estimated_value IS DISTINCT FROM OLD.estimated_value
       OR NEW.change_for IS DISTINCT FROM OLD.change_for THEN
      RAISE EXCEPTION 'Campos financeiros da entrega só podem ser alterados por administradores ou rotinas do servidor'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_financial_guard ON public.deliveries;
CREATE TRIGGER trg_delivery_financial_guard
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_financial_fields();

-- Rotina oficial de edição de entrega pendente com ajuste de créditos
CREATE OR REPLACE FUNCTION public.update_delivery_with_credits(p_delivery_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.deliveries%ROWTYPE;
  v_old_fee numeric;
  v_new_fee numeric;
  v_diff numeric;
  v_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_delivery
    FROM public.deliveries
   WHERE id = p_delivery_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF NOT public.user_owns_company(v_delivery.company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  IF v_delivery.status <> 'pending'::public.delivery_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_EDITABLE');
  END IF;

  v_old_fee := COALESCE(v_delivery.value, 0);
  v_new_fee := COALESCE((p_payload->>'value')::numeric, (p_payload->>'delivery_fee')::numeric, v_old_fee);
  v_diff := v_new_fee - v_old_fee;

  IF v_diff <> 0 THEN
    INSERT INTO public.company_credits (company_id, balance)
    VALUES (v_delivery.company_id, 0)
    ON CONFLICT (company_id) DO NOTHING;

    SELECT balance INTO v_balance
      FROM public.company_credits
     WHERE company_id = v_delivery.company_id
     FOR UPDATE;

    IF v_diff > 0 AND v_balance < v_diff THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS', 'balance', v_balance, 'required', v_diff);
    END IF;

    UPDATE public.company_credits
       SET balance = balance - v_diff
     WHERE company_id = v_delivery.company_id
    RETURNING balance INTO v_balance;

    INSERT INTO public.credit_transactions (company_id, type, amount, balance_after, description, delivery_id, created_by)
    VALUES (
      v_delivery.company_id,
      CASE WHEN v_diff > 0 THEN 'debit' ELSE 'refund' END,
      -v_diff,
      v_balance,
      'Ajuste de entrega ' || COALESCE(v_delivery.short_id, p_delivery_id::text) || ' - ' || COALESCE(p_payload->>'customer_name', v_delivery.customer_name, ''),
      p_delivery_id,
      auth.uid()
    );
  END IF;

  UPDATE public.deliveries SET
    delivery_type = COALESCE(p_payload->>'delivery_type', delivery_type),
    customer_id = NULLIF(p_payload->>'customer_id', '')::uuid,
    customer_name = COALESCE(p_payload->>'customer_name', customer_name),
    customer_phone = p_payload->>'customer_phone',
    customer_cpf = NULLIF(p_payload->>'customer_cpf', ''),
    address = COALESCE(p_payload->>'address', address),
    customer_address_number = p_payload->>'customer_address_number',
    customer_neighborhood = p_payload->>'customer_neighborhood',
    customer_address_complement = p_payload->>'customer_address_complement',
    payment_method = p_payload->>'payment_method',
    order_value = COALESCE((p_payload->>'order_value')::numeric, order_value),
    change_for = COALESCE((p_payload->>'change_for')::numeric, change_for),
    vehicle_type = p_payload->>'vehicle_type',
    region_id = NULLIF(p_payload->>'region_id', '')::uuid,
    value = v_new_fee,
    delivery_fee = v_new_fee,
    notes = p_payload->>'notes',
    updated_at = now()
  WHERE id = p_delivery_id;

  RETURN jsonb_build_object('success', true, 'delivery_id', p_delivery_id, 'balance', v_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_delivery_with_credits(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_delivery_with_credits(uuid, jsonb) TO authenticated;