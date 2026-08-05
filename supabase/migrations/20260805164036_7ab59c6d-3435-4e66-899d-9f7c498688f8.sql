CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(p_delivery_id uuid, p_status text, p_driver_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_db_status public.delivery_status;
  v_now TIMESTAMPTZ := now();
  v_order_status TEXT;
  v_order_id UUID;
  v_delivery RECORD;
  v_my_driver_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  v_my_driver_id := public.get_driver_id(auth.uid());

  -- Authorization: admin, owning company, assigned driver, or a driver claiming an unassigned delivery
  IF NOT (
    v_is_admin
    OR public.user_owns_company(v_delivery.company_id)
    OR (v_my_driver_id IS NOT NULL AND v_delivery.driver_id = v_my_driver_id)
    OR (v_my_driver_id IS NOT NULL AND v_delivery.driver_id IS NULL)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado');
  END IF;

  -- Only admins may assign an arbitrary driver; others may only assign themselves
  IF p_driver_id IS NOT NULL AND NOT v_is_admin THEN
    IF v_my_driver_id IS NULL OR p_driver_id <> v_my_driver_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Não autorizado a atribuir este entregador');
    END IF;
    IF v_delivery.driver_id IS NOT NULL AND v_delivery.driver_id <> v_my_driver_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Entrega já atribuída');
    END IF;
  END IF;

  BEGIN
    v_db_status := p_status::public.delivery_status;
  EXCEPTION WHEN OTHERS THEN
    IF p_status = 'delivered' THEN
      v_db_status := 'completed'::public.delivery_status;
    ELSIF p_status = 'in_transit' THEN
      v_db_status := 'in_route'::public.delivery_status;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Status inválido');
    END IF;
  END;

  UPDATE public.deliveries
  SET
    status = v_db_status,
    updated_at = v_now,
    driver_id = CASE WHEN p_driver_id IS NOT NULL THEN p_driver_id ELSE driver_id END,
    delivered_at = CASE WHEN v_db_status = 'completed' THEN v_now ELSE delivered_at END,
    accepted_at = CASE WHEN v_db_status = 'accepted' THEN v_now ELSE accepted_at END,
    collected_at = CASE WHEN v_db_status = 'collecting' THEN v_now ELSE collected_at END,
    cancelled_at = CASE WHEN v_db_status = 'cancelled' THEN v_now ELSE cancelled_at END
  WHERE id = p_delivery_id
  RETURNING order_id INTO v_order_id;

  IF v_db_status = 'accepted' THEN v_order_status := 'confirmed';
  ELSIF v_db_status = 'collecting' THEN v_order_status := 'preparing';
  ELSIF v_db_status = 'in_route' THEN v_order_status := 'in_route';
  ELSIF v_db_status = 'completed' THEN v_order_status := 'delivered';
  ELSIF v_db_status = 'cancelled' THEN v_order_status := 'cancelled';
  END IF;

  IF v_order_status IS NOT NULL AND v_order_id IS NOT NULL THEN
    BEGIN
      UPDATE public.orders
         SET status = v_order_status::public.order_status, updated_at = v_now
       WHERE id = v_order_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Entrega atualizada com sucesso');
END;
$function$;

REVOKE ALL ON FUNCTION public.update_delivery_status_safe(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_delivery_status_safe(uuid, text, uuid) TO authenticated;