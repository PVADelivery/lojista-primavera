-- Migration: Adicionar batch_id e RPC accept_delivery_batch para Entregas Agrupadas

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_deliveries_batch_id ON public.deliveries(batch_id);

CREATE OR REPLACE FUNCTION public.batch_create_delivery_requests(
  p_company_id UUID,
  p_deliveries JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_elem JSONB;
  v_item_value NUMERIC(10,2);
  v_total_value NUMERIC(10,2) := 0;
  v_current_balance NUMERIC(10,2) := 0;
  v_delivery_id UUID;
  v_batch_id UUID := gen_random_uuid();
  v_short_id TEXT;
  v_created_deliveries JSONB := '[]'::jsonb;
  v_rand_hex TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
  IF p_company_id IS NULL THEN RAISE EXCEPTION 'ID da empresa não informado.'; END IF;
  IF p_deliveries IS NULL OR jsonb_array_length(p_deliveries) = 0 THEN RAISE EXCEPTION 'Nenhuma entrega informada no lote.'; END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_deliveries)
  LOOP
    v_item_value := COALESCE((v_elem->>'value')::numeric, 0);
    IF v_item_value <= 0 THEN RAISE EXCEPTION 'Valor inválido de entrega encontrado: R$ %', v_item_value; END IF;
    IF COALESCE(trim(v_elem->>'customer_name'), '') = '' THEN RAISE EXCEPTION 'Nome do cliente não pode estar vazio em nenhuma entrega do lote.'; END IF;
    IF COALESCE(trim(v_elem->>'address'), '') = '' THEN RAISE EXCEPTION 'Endereço não pode estar vazio em nenhuma entrega do lote.'; END IF;
    v_total_value := v_total_value + v_item_value;
  END LOOP;

  SELECT COALESCE(balance, 0) INTO v_current_balance FROM public.company_credits WHERE company_id = p_company_id FOR UPDATE;
  IF v_current_balance IS NULL THEN v_current_balance := 0; END IF;

  IF v_current_balance < v_total_value THEN
    RAISE EXCEPTION 'Saldo de créditos insuficiente. Saldo atual: R$ %, Valor total do lote: R$ %', 
      to_char(v_current_balance, 'FM999,990.00'), to_char(v_total_value, 'FM999,990.00');
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_deliveries)
  LOOP
    v_item_value := (v_elem->>'value')::numeric;
    v_rand_hex := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
    v_short_id := '#' || v_rand_hex;

    BEGIN
      INSERT INTO public.deliveries (
        id, company_id, short_id, batch_id, customer_name, customer_phone, address, region_id, value, delivery_fee, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), p_company_id, v_short_id, v_batch_id, trim(v_elem->>'customer_name'), NULLIF(trim(v_elem->>'customer_phone'), ''), trim(v_elem->>'address'), NULLIF(v_elem->>'region_id', 'none')::uuid, v_item_value, v_item_value, 'pending'::public.delivery_status, now(), now()
      ) RETURNING id INTO v_delivery_id;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.deliveries (
        id, company_id, short_id, batch_id, customer_name, customer_phone, address, region_id, value, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), p_company_id, v_short_id, v_batch_id, trim(v_elem->>'customer_name'), NULLIF(trim(v_elem->>'customer_phone'), ''), trim(v_elem->>'address'), NULLIF(v_elem->>'region_id', 'none')::uuid, v_item_value, 'pending'::public.delivery_status, now(), now()
      ) RETURNING id INTO v_delivery_id;
    END;

    v_current_balance := v_current_balance - v_item_value;

    BEGIN
      INSERT INTO public.credit_transactions (company_id, type, amount, balance_after, description, delivery_id, created_at)
      VALUES (p_company_id, 'debit', -v_item_value, v_current_balance, 'Débito de entrega em lote ' || v_short_id, v_delivery_id, now());
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.company_credit_transactions (company_id, type, amount, balance_after, description, reference_id, created_at)
        VALUES (p_company_id, 'debit', -v_item_value, v_current_balance, 'Débito de entrega em lote ' || v_short_id, v_delivery_id, now());
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;

    v_created_deliveries := v_created_deliveries || jsonb_build_object(
      'id', v_delivery_id, 'short_id', v_short_id, 'batch_id', v_batch_id, 'value', v_item_value, 'customer_name', trim(v_elem->>'customer_name')
    );
  END LOOP;

  UPDATE public.company_credits SET balance = v_current_balance, total_consumed = COALESCE(total_consumed, 0) + v_total_value, updated_at = now() WHERE company_id = p_company_id;

  RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id, 'count', jsonb_array_length(p_deliveries), 'deliveries', v_created_deliveries, 'total', v_total_value, 'balance_after', v_current_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_delivery_batch(
  p_batch_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
  IF p_batch_id IS NULL THEN RAISE EXCEPTION 'ID do lote não informado.'; END IF;
  IF p_driver_id IS NULL THEN RAISE EXCEPTION 'ID do entregador não informado.'; END IF;

  UPDATE public.deliveries
     SET status = 'accepted'::public.delivery_status, driver_id = p_driver_id, accepted_at = v_now, updated_at = v_now
   WHERE batch_id = p_batch_id
     AND (status = 'pending'::public.delivery_status OR status = 'broadcasted'::public.delivery_status);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'Este lote não está mais disponível para aceite.'; END IF;

  RETURN jsonb_build_object('success', true, 'accepted_count', v_count, 'batch_id', p_batch_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_create_delivery_requests(UUID, JSONB) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.accept_delivery_batch(UUID, UUID) TO authenticated, anon, public;
NOTIFY pgrst, 'reload schema';
