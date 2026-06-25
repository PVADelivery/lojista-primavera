-- ============================================================
-- Migration: 20260621160000_fix_marketplace_checkout_bugs
-- BUG FIX: 
-- 1. Adds p_delivery_fee to create_order_v3 so frontend calculations are respected.
-- 2. Fixes handle_order_ready_automation so deliveries.value is NEW.delivery_fee (driver pay).
-- 3. Improves customer phone fetch in handle_order_ready_automation from addresses.
-- ============================================================

-- =========================================================
-- 1. Rebuild create_order_v3 with p_delivery_fee
-- =========================================================
DROP FUNCTION IF EXISTS public.create_order_v3(jsonb, uuid, uuid, text, text, text, boolean, numeric, text);

CREATE OR REPLACE FUNCTION public.create_order_v3(
  p_items jsonb,
  p_company_id uuid,
  p_address_id uuid,
  p_payment_method text,
  p_coupon_code text DEFAULT NULL::text,
  p_notes text DEFAULT NULL::text,
  p_needs_change boolean DEFAULT false,
  p_change_for numeric DEFAULT NULL::numeric,
  p_idempotency_key text DEFAULT NULL::text,
  p_delivery_fee numeric DEFAULT NULL::numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_customer_id uuid;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_item record;
  v_product record;
  v_company record;
  v_address record;
  v_coupon record;
  v_final_notes text;
  v_delivery_address text;
  v_region_id uuid;
  v_coupon_ok boolean;
  v_has_scope boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_address FROM public.addresses WHERE id = p_address_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Address not found');
  END IF;

  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Company not found');
  END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE user_id = v_user_id LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (user_id, name, phone)
    VALUES (v_user_id, COALESCE((SELECT full_name FROM public.profiles WHERE id = v_user_id), 'Cliente'), COALESCE(v_address.phone, (SELECT phone FROM public.profiles WHERE id = v_user_id)))
    RETURNING id INTO v_customer_id;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_order_id FROM public.orders WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('order_id', v_order_id, 'idempotent', true);
    END IF;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity int, notes text, options jsonb)
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Product ' || v_item.product_id || ' not found');
    END IF;
    IF v_product.company_id != p_company_id THEN
      RETURN jsonb_build_object('error', 'Product ' || v_item.product_id || ' does not belong to company');
    END IF;
    v_subtotal := v_subtotal + (v_product.price * v_item.quantity);
  END LOOP;

  IF p_coupon_code IS NOT NULL AND p_coupon_code != '' THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE code = UPPER(p_coupon_code) AND active = true;
    IF FOUND THEN
      v_coupon_ok := true;

      IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
        v_coupon_ok := false;
      END IF;

      IF v_coupon.usage_limit IS NOT NULL
         AND COALESCE(v_coupon.used_count, 0) >= v_coupon.usage_limit THEN
        v_coupon_ok := false;
      END IF;

      IF v_coupon.min_order_value IS NOT NULL AND v_subtotal < v_coupon.min_order_value THEN
        v_coupon_ok := false;
      END IF;

      -- Escopo por loja
      IF v_coupon.company_id IS NOT NULL AND v_coupon.company_id <> p_company_id THEN
        v_coupon_ok := false;
      END IF;

      IF v_coupon_ok AND v_coupon.company_id IS NULL THEN
        SELECT EXISTS(SELECT 1 FROM public.coupon_companies WHERE coupon_id = v_coupon.id)
          INTO v_has_scope;
        IF v_has_scope AND NOT EXISTS (
          SELECT 1 FROM public.coupon_companies
           WHERE coupon_id = v_coupon.id AND company_id = p_company_id
        ) THEN
          v_coupon_ok := false;
        END IF;
      END IF;

      IF v_coupon_ok THEN
        IF v_coupon.discount_type = 'percentage' THEN
          v_discount := (v_subtotal * v_coupon.discount_value / 100);
          IF v_coupon.max_discount_value IS NOT NULL THEN
            v_discount := LEAST(v_discount, v_coupon.max_discount_value);
          END IF;
        ELSE
          v_discount := LEAST(v_subtotal, v_coupon.discount_value);
        END IF;

        UPDATE public.coupons
           SET used_count = COALESCE(used_count, 0) + 1
         WHERE id = v_coupon.id;
      END IF;
    END IF;
  END IF;

  -- ── RESOLVER A TAXA DE ENTREGA ─────────────────────────────────
  -- Se o frontend passou explicitamente a taxa, usamos ela.
  IF p_delivery_fee IS NOT NULL THEN
    v_delivery_fee := p_delivery_fee;
    v_region_id := v_address.region_id; -- Pega do endereco, se houver
  ELSE
    -- Caso contrario (fallback antigo)
    IF v_company.delivery_fee IS NOT NULL THEN
      v_delivery_fee := v_company.delivery_fee;
    ELSE
      SELECT id, COALESCE(price, delivery_fee, 0) INTO v_region_id, v_delivery_fee
      FROM public.regions
      WHERE active = true
      ORDER BY price ASC LIMIT 1;
    END IF;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount) + v_delivery_fee;

  v_final_notes := p_notes;
  IF p_payment_method = 'money' AND p_needs_change AND p_change_for IS NOT NULL THEN
    v_final_notes := COALESCE(v_final_notes || ' • ', '') || 'Troco para R$ ' || p_change_for::text;
  END IF;

  v_delivery_address := v_address.street || ', ' || v_address.number || ' - ' || v_address.neighborhood || ', ' || v_address.city;

  INSERT INTO public.orders (
    customer_id, user_id, company_id, status, total, delivery_fee,
    delivery_address, payment_method, notes, idempotency_key, region_id,
    delivery_latitude, delivery_longitude
  ) VALUES (
    v_customer_id, v_user_id, p_company_id, 'pending', v_total, v_delivery_fee,
    v_delivery_address, p_payment_method, v_final_notes, p_idempotency_key, v_region_id,
    v_address.latitude, v_address.longitude
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_id, quantity, price, unit_price, product_name, notes, options)
  SELECT v_order_id, x.product_id, x.quantity, p.price, p.price, p.name, x.notes, x.options
  FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity int, notes text, options jsonb)
  JOIN public.products p ON p.id = x.product_id;

  RETURN jsonb_build_object('order_id', v_order_id, 'success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$function$;

-- Allow calls
GRANT EXECUTE ON FUNCTION public.create_order_v3 TO authenticated;


-- =========================================================
-- 2. Fix handle_order_ready_automation — populate ALL customer
--    and address fields so drivers see proper data. 
--    FIX BUG: value = NEW.delivery_fee instead of NEW.total
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_order_ready_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_customer_name  TEXT;
    v_customer_phone TEXT;
    v_address        TEXT;
    v_delivery_id    UUID;
    v_company        RECORD;
BEGIN
    -- Only fire when transitioning INTO 'ready' status
    IF NOT (NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready')) THEN
        RETURN NEW;
    END IF;

    -- Skip if a delivery is already linked to this order
    IF NEW.delivery_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Also check by order_id in case delivery_id column wasn't updated yet
    SELECT id INTO v_delivery_id
      FROM public.deliveries
     WHERE order_id = NEW.id AND status != 'cancelled'
     LIMIT 1;

    IF v_delivery_id IS NOT NULL THEN
        -- Link it back in case it wasn't set
        UPDATE public.orders SET delivery_id = v_delivery_id WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    -- ── Resolve customer name and PHONE ────────────────────────────
    BEGIN
        IF NEW.user_id IS NOT NULL THEN
            SELECT full_name, phone
              INTO v_customer_name, v_customer_phone
              FROM public.profiles
             WHERE id = NEW.user_id; -- FIXED: profiles PK is id, not user_id!
        END IF;

        IF (v_customer_name IS NULL OR v_customer_phone IS NULL OR v_customer_phone = '') AND NEW.customer_id IS NOT NULL THEN
            SELECT c.name, COALESCE(c.phone, v_customer_phone)
              INTO v_customer_name, v_customer_phone
              FROM public.customers c
             WHERE c.id = NEW.customer_id;
        END IF;

        -- NOVO: Se o telefone ainda estiver nulo, tentar puxar do address do pedido (caso salvamos)
        IF (v_customer_phone IS NULL OR v_customer_phone = '') AND NEW.address_id IS NOT NULL THEN
            SELECT phone INTO v_customer_phone
              FROM public.addresses
             WHERE id = NEW.address_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- keep defaults
    END;

    v_customer_name  := COALESCE(v_customer_name, 'Cliente');
    v_customer_phone := COALESCE(v_customer_phone, '');

    -- ── Resolve delivery address ───────────────────────────────────
    BEGIN
        IF NEW.address_id IS NOT NULL THEN
            SELECT (street || ', ' || COALESCE(number, 'S/N') || ' - ' || neighborhood || ' - ' || city)
              INTO v_address
              FROM public.addresses
             WHERE id = NEW.address_id;
        END IF;

        IF v_address IS NULL THEN
            v_address := NEW.delivery_address;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_address := NEW.delivery_address;
    END;

    v_address := COALESCE(v_address, 'Endereço não informado');

    -- ── Resolve company (pickup) data ─────────────────────────────
    BEGIN
        SELECT * INTO v_company FROM public.companies WHERE id = NEW.company_id;
    EXCEPTION WHEN OTHERS THEN
        -- leave v_company null; pickup fields will be null
    END;

    -- ── Create the delivery with full customer & address data ──────
    INSERT INTO public.deliveries (
        company_id,
        order_id,
        customer_name,
        customer_phone,
        address,
        dropoff_address,
        delivery_address,
        delivery_latitude,
        delivery_longitude,
        pickup_address,
        pickup_latitude,
        pickup_longitude,
        value,
        price,
        region_id,
        status,
        created_at,
        updated_at
    ) VALUES (
        NEW.company_id,
        NEW.id,
        v_customer_name,
        v_customer_phone,
        v_address,
        v_address,
        v_address,
        NEW.delivery_latitude,
        NEW.delivery_longitude,
        COALESCE(v_company.address, ''),
        v_company.latitude,
        v_company.longitude,
        NEW.delivery_fee,   -- BUG FIX #2: Era NEW.total, agora é apenas a taxa de entrega (p/ motoboy)
        NEW.delivery_fee,   -- price tb como taxa
        NEW.region_id,
        'pending',
        now(),
        now()
    ) RETURNING id INTO v_delivery_id;

    -- Link the order to its new delivery
    UPDATE public.orders SET delivery_id = v_delivery_id WHERE id = NEW.id;

    RETURN NEW;
END;
$function$;
