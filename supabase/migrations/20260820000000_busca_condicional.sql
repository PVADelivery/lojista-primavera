-- ============================================================================
-- MIGRATION: BUSCA DE CONDICIONAL
-- ============================================================================

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'NORMAL';
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_type ON public.deliveries(delivery_type);

CREATE OR REPLACE FUNCTION public.create_delivery_with_credits(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid := (p_payload->>'company_id')::uuid;
  v_fee numeric := COALESCE((p_payload->>'value')::numeric, (p_payload->>'delivery_fee')::numeric, 0);
  v_balance numeric;
  v_delivery_id uuid;
  v_comp_name text;
  v_comp_addr text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  IF NOT (public.user_owns_company(v_company_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_FEE');
  END IF;

  SELECT name, address INTO v_comp_name, v_comp_addr
    FROM public.companies
   WHERE id = v_company_id;

  INSERT INTO public.company_credits (company_id, balance)
  VALUES (v_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT balance INTO v_balance
    FROM public.company_credits
   WHERE company_id = v_company_id
   FOR UPDATE;

  IF v_balance < v_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS', 'balance', v_balance, 'required', v_fee);
  END IF;

  INSERT INTO public.deliveries (
    company_id, customer_id, short_id, customer_name, customer_phone, customer_cpf, address,
    customer_address_number, customer_neighborhood, customer_address_complement,
    payment_method, order_value, change_for, vehicle_type, region_id, value, delivery_fee, notes, status,
    delivery_type, company_name, pickup_address
  ) VALUES (
    v_company_id,
    NULLIF(p_payload->>'customer_id', '')::uuid,
    p_payload->>'short_id',
    COALESCE(p_payload->>'customer_name', 'Cliente'),
    p_payload->>'customer_phone',
    NULLIF(p_payload->>'customer_cpf', ''),
    COALESCE(p_payload->>'address', 'Endereço não informado'),
    p_payload->>'customer_address_number',
    p_payload->>'customer_neighborhood',
    p_payload->>'customer_address_complement',
    p_payload->>'payment_method',
    COALESCE((p_payload->>'order_value')::numeric, 0),
    COALESCE((p_payload->>'change_for')::numeric, 0),
    p_payload->>'vehicle_type',
    NULLIF(p_payload->>'region_id', '')::uuid,
    v_fee,
    v_fee,
    p_payload->>'notes',
    'pending'::public.delivery_status,
    COALESCE(p_payload->>'delivery_type', 'NORMAL'),
    COALESCE(p_payload->>'company_name', v_comp_name, 'Loja'),
    COALESCE(p_payload->>'pickup_address', v_comp_addr, 'Loja')
  ) RETURNING id INTO v_delivery_id;

  UPDATE public.company_credits
     SET balance = balance - v_fee
   WHERE company_id = v_company_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_transactions (company_id, type, amount, balance_after, description, delivery_id, created_by)
  VALUES (v_company_id, 'debit', -v_fee, v_balance,
          (CASE WHEN (p_payload->>'delivery_type') = 'BUSCA_CONDICIONAL' THEN 'Busca de Condicional ' ELSE 'Entrega ' END) || COALESCE(p_payload->>'short_id', '') || ' - ' || COALESCE(p_payload->>'customer_name', ''),
          v_delivery_id, auth.uid());

  RETURN jsonb_build_object('success', true, 'delivery_id', v_delivery_id, 'balance', v_balance);
END;
$$;
