-- =========================================================================
-- MIGRATION: Garantir 100% que o valor da entrega para o entregador/admin
-- venha SEMPRE da Tabela de Preços do Admin vinculada à Loja (ou tabela de regiões padrão)
-- e NUNCA do valor que a loja cobra do cliente final.
-- =========================================================================

-- 1. Função definitiva de cálculo de taxa de entrega da tabela do Admin
CREATE OR REPLACE FUNCTION public.calculate_delivery_fee_for_company(
  p_company_id UUID,
  p_address TEXT,
  p_region_id UUID DEFAULT NULL,
  p_vehicle_type TEXT DEFAULT 'moto'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table_id UUID;
  v_reg_id UUID := p_region_id;
  v_fee NUMERIC(10,2);
  v_clean_addr TEXT;
  v_is_car BOOLEAN := (LOWER(COALESCE(p_vehicle_type, 'moto')) LIKE '%car%');
BEGIN
  -- 1. Obter a tabela de preços da empresa no Admin
  SELECT pricing_table_id INTO v_table_id FROM public.companies WHERE id = p_company_id;
  IF v_table_id IS NULL THEN
    SELECT id INTO v_table_id FROM public.pricing_tables WHERE is_default = true LIMIT 1;
  END IF;

  v_clean_addr := LOWER(COALESCE(p_address, ''));

  -- 2. Se region_id não foi passado, tentar resolver por bairros (region_neighborhoods)
  IF v_reg_id IS NULL AND v_clean_addr <> '' THEN
    SELECT rn.region_id INTO v_reg_id
      FROM public.region_neighborhoods rn
     WHERE v_clean_addr LIKE '%' || LOWER(TRIM(rn.name)) || '%'
     ORDER BY LENGTH(rn.name) DESC
     LIMIT 1;

    -- Tenta por nome da região (regions)
    IF v_reg_id IS NULL THEN
      SELECT r.id INTO v_reg_id
        FROM public.regions r
       WHERE v_clean_addr LIKE '%' || LOWER(TRIM(r.name)) || '%'
          OR LOWER(TRIM(r.name)) LIKE '%' || SPLIT_PART(v_clean_addr, ',', 1) || '%'
       ORDER BY LENGTH(r.name) DESC
       LIMIT 1;
    END IF;
  END IF;

  -- 3. Se ainda não encontrou região, pega a primeira região da tabela de preços ou do sistema
  IF v_reg_id IS NULL THEN
    IF v_table_id IS NOT NULL THEN
      SELECT COALESCE(destination_region_id, origin_region_id) INTO v_reg_id
        FROM public.pricing_rules
       WHERE pricing_table_id = v_table_id
         AND base_value > 0
       LIMIT 1;
    END IF;
    IF v_reg_id IS NULL THEN
      SELECT id INTO v_reg_id FROM public.regions ORDER BY name ASC LIMIT 1;
    END IF;
  END IF;

  -- 4. Buscar valor na tabela de preços personalizada vinculada à empresa (pricing_rules)
  IF v_table_id IS NOT NULL AND v_reg_id IS NOT NULL THEN
    IF v_is_car THEN
      SELECT COALESCE(pr.return_value, pr.base_value * 1.5) INTO v_fee
        FROM public.pricing_rules pr
       WHERE pr.pricing_table_id = v_table_id
         AND (pr.origin_region_id = v_reg_id OR pr.destination_region_id = v_reg_id)
         AND pr.base_value > 0
       LIMIT 1;
    ELSE
      SELECT pr.base_value INTO v_fee
        FROM public.pricing_rules pr
       WHERE pr.pricing_table_id = v_table_id
         AND (pr.origin_region_id = v_reg_id OR pr.destination_region_id = v_reg_id)
         AND pr.base_value > 0
       LIMIT 1;
    END IF;
  END IF;

  -- 5. Se não encontrou regra personalizada na tabela da empresa, busca na tabela padrão de regiões do Admin
  IF v_fee IS NULL OR v_fee <= 0 THEN
    IF v_reg_id IS NOT NULL THEN
      IF v_is_car THEN
        SELECT COALESCE(delivery_fee, price * 1.5, 25.00) INTO v_fee
          FROM public.regions
         WHERE id = v_reg_id;
      ELSE
        SELECT COALESCE(price, delivery_fee, 10.00) INTO v_fee
          FROM public.regions
         WHERE id = v_reg_id;
      END IF;
    END IF;
  END IF;

  -- 6. Fallback final garantido
  IF v_fee IS NULL OR v_fee <= 0 THEN
    v_fee := CASE WHEN v_is_car THEN 25.00 ELSE 10.00 END;
  END IF;

  RETURN v_fee;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_delivery_fee_for_company(UUID, TEXT, UUID, TEXT) TO authenticated, anon, public;

-- 2. Atualizar a trigger de automação de pedidos para SEMPRE usar a tabela do Admin
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
    v_admin_fee       NUMERIC(10,2);
    v_region_id       UUID;
BEGIN
    -- Dispara quando o pedido entra em 'ready' (Pronto) ou 'in_route'
    IF NOT (NEW.status IN ('ready', 'in_route') AND (OLD.status IS NULL OR OLD.status NOT IN ('ready', 'in_route'))) THEN
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

    -- Resolver dados do cliente
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

    -- Resolver dados da empresa
    BEGIN
        SELECT * INTO v_company FROM public.companies WHERE id = NEW.company_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- CALCULAR O VALOR OFICIAL DA TABELA DE PREÇOS DO ADMIN PARA O ENTREGADOR
    v_admin_fee := public.calculate_delivery_fee_for_company(NEW.company_id, v_address, v_region_id, 'moto');

    -- Inserir entrega com o valor oficial do Admin
    INSERT INTO public.deliveries (
        company_id, order_id, customer_name, customer_phone,
        address, dropoff_address, delivery_address,
        delivery_latitude, delivery_longitude,
        pickup_address, pickup_latitude, pickup_longitude,
        value, price, delivery_fee, region_id, status, created_at, updated_at
    ) VALUES (
        NEW.company_id, NEW.id, v_customer_name, v_customer_phone,
        v_address, v_address, v_address,
        NEW.delivery_latitude, NEW.delivery_longitude,
        COALESCE(v_company.address, ''), v_company.latitude, v_company.longitude,
        v_admin_fee, v_admin_fee, v_admin_fee, v_region_id,
        'pending', now(), now()
    ) RETURNING id INTO v_delivery_id;

    UPDATE public.orders SET delivery_id = v_delivery_id WHERE id = NEW.id;

    RETURN NEW;
END;
$function$;

-- 3. Trigger BEFORE INSERT on deliveries para garantir que value e delivery_fee NUNCA fiquem zerados ou errados
CREATE OR REPLACE FUNCTION public.trg_enforce_admin_pricing_on_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_fee NUMERIC(10,2);
BEGIN
  -- Se o company_id estiver preenchido e o valor estiver zerado ou ausente
  IF NEW.company_id IS NOT NULL AND (NEW.value IS NULL OR NEW.value <= 0) THEN
    NEW.value := public.calculate_delivery_fee_for_company(
      NEW.company_id, 
      COALESCE(NEW.address, NEW.delivery_address, ''), 
      NEW.region_id, 
      COALESCE(NEW.vehicle_type, 'moto')
    );
  END IF;

  IF NEW.value IS NOT NULL AND (NEW.delivery_fee IS NULL OR NEW.delivery_fee <= 0) THEN
    NEW.delivery_fee := NEW.value;
  END IF;

  IF NEW.value IS NOT NULL AND (NEW.price IS NULL OR NEW.price <= 0) THEN
    NEW.price := NEW.value;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_admin_pricing ON public.deliveries;
CREATE TRIGGER trg_enforce_admin_pricing
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_admin_pricing_on_deliveries();

-- 4. Corrigir entregas recentes com status pending/accepted que foram criadas com valor incorreto
UPDATE public.deliveries d
   SET value = public.calculate_delivery_fee_for_company(d.company_id, d.address, d.region_id, COALESCE(d.vehicle_type, 'moto')),
       delivery_fee = public.calculate_delivery_fee_for_company(d.company_id, d.address, d.region_id, COALESCE(d.vehicle_type, 'moto')),
       price = public.calculate_delivery_fee_for_company(d.company_id, d.address, d.region_id, COALESCE(d.vehicle_type, 'moto'))
 WHERE d.company_id IS NOT NULL
   AND d.created_at > now() - interval '24 hours'
   AND d.status IN ('pending', 'accepted', 'in_transit');

NOTIFY pgrst, 'reload schema';
