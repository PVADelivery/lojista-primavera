-- =========================================================================
-- MIGRATION: Corrigir cálculo de frete oficial da tabela do Admin na automação de pedidos prontos
-- Garante que NUNCA seja usado NEW.delivery_fee (taxa que a loja cobra do cliente)
-- e SEMPRE seja calculada a taxa oficial da tabela de preços do Admin (pricing_rules / regions.price)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_order_ready_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_customer_name   TEXT;
    v_customer_phone  TEXT;
    v_address         TEXT;
    v_delivery_id     UUID;
    v_company         RECORD;
    v_admin_fee       NUMERIC(10,2) := 10.00;
    v_table_id        UUID;
    v_rule_val        NUMERIC(10,2);
    v_reg_price       NUMERIC(10,2);
    v_region_id       UUID;
BEGIN
    -- Dispara apenas quando o pedido entra em 'ready' (Pronto)
    IF NOT (NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready')) THEN
        RETURN NEW;
    END IF;

    -- Se já possui entrega vinculada
    IF NEW.delivery_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Não cria entrega para retirada no local
    IF NEW.delivery_address = 'Retirada na Loja' 
       OR NEW.delivery_address = '[RETIRADA NO LOCAL]' 
       OR (NEW.notes IS NOT NULL AND NEW.notes ILIKE '%[RETIRADA NO LOCAL]%') THEN
        RETURN NEW;
    END IF;

    SELECT id INTO v_delivery_id
      FROM public.deliveries
     WHERE order_id = NEW.id AND status != 'cancelled'
     LIMIT 1;

    IF v_delivery_id IS NOT NULL THEN
        UPDATE public.orders SET delivery_id = v_delivery_id WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    -- 1. Resolver dados do cliente
    BEGIN
        IF NEW.user_id IS NOT NULL THEN
            SELECT full_name, phone
              INTO v_customer_name, v_customer_phone
              FROM public.profiles
             WHERE id = NEW.user_id;
        END IF;

        IF (v_customer_name IS NULL OR v_customer_phone IS NULL OR v_customer_phone = '') AND NEW.customer_id IS NOT NULL THEN
            SELECT c.name, COALESCE(c.phone, v_customer_phone)
              INTO v_customer_name, v_customer_phone
              FROM public.customers c
             WHERE c.id = NEW.customer_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
    END;

    v_customer_name  := COALESCE(v_customer_name, 'Cliente');
    v_customer_phone := COALESCE(v_customer_phone, '');
    v_address        := COALESCE(NEW.delivery_address, 'Endereço não informado');
    v_region_id      := NEW.region_id;

    -- 2. Resolver dados da empresa
    BEGIN
        SELECT * INTO v_company FROM public.companies WHERE id = NEW.company_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- Se region_id não estiver preenchido no pedido, tenta buscar por bairro no endereço
    IF v_region_id IS NULL AND v_address IS NOT NULL THEN
        BEGIN
            SELECT rn.region_id INTO v_region_id
              FROM public.region_neighborhoods rn
             WHERE v_address ILIKE '%' || rn.name || '%'
             LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
        END;
    END IF;

    -- 3. CALCULAR O VALOR OFICIAL DA TABELA DE PREÇOS DO ADMIN PARA O ENTREGADOR / SISTEMA
    IF v_region_id IS NOT NULL THEN
        -- A) Buscar tabela de preços personalizada vinculada à empresa
        SELECT c.pricing_table_id INTO v_table_id FROM public.companies c WHERE c.id = NEW.company_id;
        IF v_table_id IS NULL THEN
            SELECT pt.id INTO v_table_id FROM public.pricing_tables pt WHERE pt.is_default = true LIMIT 1;
        END IF;

        IF v_table_id IS NOT NULL THEN
            SELECT pr.base_value INTO v_rule_val
              FROM public.pricing_rules pr
             WHERE pr.pricing_table_id = v_table_id
               AND (pr.origin_region_id = v_region_id OR pr.destination_region_id = v_region_id)
               AND pr.base_value IS NOT NULL AND pr.base_value > 0
             LIMIT 1;

            IF v_rule_val IS NOT NULL AND v_rule_val > 0 THEN
                v_admin_fee := v_rule_val;
            END IF;
        END IF;

        -- B) Se não achou na tabela personalizada, busca valor padrão oficial da região no Admin
        IF v_rule_val IS NULL OR v_rule_val <= 0 THEN
            SELECT COALESCE(price, delivery_fee, 10.00) INTO v_reg_price
              FROM public.regions
             WHERE id = v_region_id;
            IF v_reg_price IS NOT NULL AND v_reg_price > 0 THEN
                v_admin_fee := v_reg_price;
            END IF;
        END IF;
    END IF;

    -- 4. Inserir entrega com o valor oficial do Admin (repassando 75% ao entregador)
    INSERT INTO public.deliveries (
        company_id, order_id, customer_name, customer_phone,
        address, dropoff_address, delivery_address,
        delivery_latitude, delivery_longitude,
        pickup_address, pickup_latitude, pickup_longitude,
        value, price, region_id, status, created_at, updated_at
    ) VALUES (
        NEW.company_id, NEW.id, v_customer_name, v_customer_phone,
        v_address, v_address, v_address,
        NEW.delivery_latitude, NEW.delivery_longitude,
        COALESCE(v_company.address, ''), v_company.latitude, v_company.longitude,
        v_admin_fee, v_admin_fee, v_region_id,
        'pending', now(), now()
    ) RETURNING id INTO v_delivery_id;

    UPDATE public.orders SET delivery_id = v_delivery_id WHERE id = NEW.id;

    RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
