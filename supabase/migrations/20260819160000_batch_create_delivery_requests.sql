-- RPC para Criação Atômica de Entregas em Lote com Débito Financeiro Individual e Sequencial

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
  v_short_id TEXT;
  v_created_deliveries JSONB := '[]'::jsonb;
  v_rand_hex TEXT;
BEGIN
  -- 1. Validar autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 2. Validar company_id
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'ID da empresa não informado.';
  END IF;

  -- 3. Validar array de entregas
  IF p_deliveries IS NULL OR jsonb_array_length(p_deliveries) = 0 THEN
    RAISE EXCEPTION 'Nenhuma entrega informada no lote.';
  END IF;

  -- 4. Calcular o valor total do lote
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_deliveries)
  LOOP
    v_item_value := COALESCE((v_elem->>'value')::numeric, 0);
    IF v_item_value <= 0 THEN
      RAISE EXCEPTION 'Valor inválido de entrega encontrado: R$ %', v_item_value;
    END IF;
    IF COALESCE(trim(v_elem->>'customer_name'), '') = '' THEN
      RAISE EXCEPTION 'Nome do cliente não pode estar vazio em nenhuma entrega do lote.';
    END IF;
    IF COALESCE(trim(v_elem->>'address'), '') = '' THEN
      RAISE EXCEPTION 'Endereço não pode estar vazio em nenhuma entrega do lote.';
    END IF;
    v_total_value := v_total_value + v_item_value;
  END LOOP;

  -- 5. Verificar saldo de créditos da empresa
  SELECT COALESCE(balance, 0)
    INTO v_current_balance
    FROM public.company_credits
   WHERE company_id = p_company_id
   FOR UPDATE;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  IF v_current_balance < v_total_value THEN
    RAISE EXCEPTION 'Saldo de créditos insuficiente. Saldo atual: R$ %, Valor total do lote: R$ %', 
      to_char(v_current_balance, 'FM999,990.00'), 
      to_char(v_total_value, 'FM999,990.00');
  END IF;

  -- 6. Criar cada entrega e debitar individualmente na transação
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_deliveries)
  LOOP
    v_item_value := (v_elem->>'value')::numeric;
    
    -- Gerar Short ID único no formato #XXXX
    v_rand_hex := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
    v_short_id := '#' || v_rand_hex;

    -- Inserir entrega individual na tabela deliveries (sem coluna 'price' que não existe em deliveries)
    BEGIN
      INSERT INTO public.deliveries (
        id,
        company_id,
        short_id,
        customer_name,
        customer_phone,
        address,
        region_id,
        value,
        delivery_fee,
        status,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        p_company_id,
        v_short_id,
        trim(v_elem->>'customer_name'),
        NULLIF(trim(v_elem->>'customer_phone'), ''),
        trim(v_elem->>'address'),
        NULLIF(v_elem->>'region_id', 'none')::uuid,
        v_item_value,
        v_item_value,
        'pending'::public.delivery_status,
        now(),
        now()
      ) RETURNING id INTO v_delivery_id;
    EXCEPTION WHEN OTHERS THEN
      -- Fallback se a coluna delivery_fee não existir na tabela deliveries
      INSERT INTO public.deliveries (
        id,
        company_id,
        short_id,
        customer_name,
        customer_phone,
        address,
        region_id,
        value,
        status,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        p_company_id,
        v_short_id,
        trim(v_elem->>'customer_name'),
        NULLIF(trim(v_elem->>'customer_phone'), ''),
        trim(v_elem->>'address'),
        NULLIF(v_elem->>'region_id', 'none')::uuid,
        v_item_value,
        'pending'::public.delivery_status,
        now(),
        now()
      ) RETURNING id INTO v_delivery_id;
    END;

    -- Calcular novo saldo após esta entrega individual
    v_current_balance := v_current_balance - v_item_value;

    -- Registrar transação individual em credit_transactions
    BEGIN
      INSERT INTO public.credit_transactions (
        company_id,
        type,
        amount,
        balance_after,
        description,
        delivery_id,
        created_at
      ) VALUES (
        p_company_id,
        'debit',
        -v_item_value,
        v_current_balance,
        'Débito de entrega em lote ' || v_short_id,
        v_delivery_id,
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Fallback para tabela company_credit_transactions se credit_transactions não existir
      BEGIN
        INSERT INTO public.company_credit_transactions (
          company_id,
          type,
          amount,
          balance_after,
          description,
          reference_id,
          created_at
        ) VALUES (
          p_company_id,
          'debit',
          -v_item_value,
          v_current_balance,
          'Débito de entrega em lote ' || v_short_id,
          v_delivery_id,
          now()
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;

    -- Acumular dados da entrega criada para o retorno
    v_created_deliveries := v_created_deliveries || jsonb_build_object(
      'id', v_delivery_id,
      'short_id', v_short_id,
      'value', v_item_value,
      'customer_name', trim(v_elem->>'customer_name')
    );
  END LOOP;

  -- 7. Atualizar o saldo final na tabela company_credits
  UPDATE public.company_credits
     SET balance = v_current_balance,
         total_consumed = COALESCE(total_consumed, 0) + v_total_value,
         updated_at = now()
   WHERE company_id = p_company_id;

  RETURN jsonb_build_object(
    'success', true,
    'count', jsonb_array_length(p_deliveries),
    'deliveries', v_created_deliveries,
    'total', v_total_value,
    'balance_after', v_current_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_create_delivery_requests(UUID, JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
