-- Migration: Permitir edição de entregas em qualquer etapa ativa (menos concluídas ou canceladas)

CREATE OR REPLACE FUNCTION public.update_delivery_with_credits(p_delivery_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Bloqueia apenas entregas concluídas ou canceladas
  IF v_delivery.status::text IN ('completed', 'delivered', 'cancelled', 'canceled') THEN
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
