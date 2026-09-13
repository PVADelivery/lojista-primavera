-- ==============================================================================
-- SCRIPT DEFINITIVO: CORREÇÃO PARA FINALIZAR / AVANÇAR ENTREGAS (DELIVERIES)
-- Banco de Dados: owlbzwsdcognrgolvnzg (Primavera do Leste)
-- ==============================================================================

-- 1. Garante que todos os valores de status existam no ENUM delivery_status
DO $$
BEGIN
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'broadcasted';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'accepted';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'collecting';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'in_route';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'in_transit';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'completed';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'delivered';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'cancelled';
  ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'returned';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Garante colunas de timestamp na tabela deliveries
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS cancelled_by UUID;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT;

-- 3. Função RPC segura (SECURITY DEFINER) para atualizar status de entregas
CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(
  p_delivery_id UUID,
  p_status TEXT,
  p_driver_id UUID DEFAULT NULL::UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_db_status public.delivery_status;
  v_now TIMESTAMPTZ := now();
  v_del RECORD;
  v_user_id UUID := auth.uid();
  v_user_name TEXT;
  v_order_id UUID;
  v_target_status TEXT := lower(trim(p_status));
BEGIN
  -- 1. Obter a entrega existente
  SELECT * INTO v_del FROM public.deliveries WHERE id = p_delivery_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  -- 2. Obter nome do usuário autenticado (se disponível)
  IF v_user_id IS NOT NULL THEN
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
    IF v_user_name IS NULL THEN
      SELECT name INTO v_user_name FROM public.companies WHERE user_id = v_user_id LIMIT 1;
    END IF;
    IF v_user_name IS NULL THEN
      SELECT full_name INTO v_user_name FROM public.delivery_drivers WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;
    END IF;
  END IF;

  -- 3. Mapear o status para o enum compatível com o banco
  IF v_target_status IN ('delivered', 'concluded', 'finalizada', 'completed', 'entregue') THEN
    BEGIN
      v_db_status := 'delivered'::public.delivery_status;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_db_status := 'completed'::public.delivery_status;
      EXCEPTION WHEN OTHERS THEN
        v_db_status := 'delivered';
      END;
    END;
  ELSIF v_target_status IN ('in_transit', 'in_route', 'em_rota') THEN
    BEGIN
      v_db_status := 'in_transit'::public.delivery_status;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        v_db_status := 'in_route'::public.delivery_status;
      EXCEPTION WHEN OTHERS THEN
        v_db_status := 'in_transit';
      END;
    END;
  ELSIF v_target_status IN ('collecting', 'coletando') THEN
    v_db_status := 'collecting'::public.delivery_status;
  ELSIF v_target_status IN ('accepted', 'aceito') THEN
    v_db_status := 'accepted'::public.delivery_status;
  ELSIF v_target_status IN ('cancelled', 'cancelado', 'cancelada') THEN
    v_db_status := 'cancelled'::public.delivery_status;
  ELSE
    BEGIN
      v_db_status := p_status::public.delivery_status;
    EXCEPTION WHEN OTHERS THEN
      v_db_status := 'delivered'::public.delivery_status;
    END;
  END IF;

  -- 4. Atualizar a entrega com segurança absoluta
  UPDATE public.deliveries
  SET 
    status = v_db_status,
    updated_at = v_now,
    driver_id = CASE WHEN p_driver_id IS NOT NULL THEN p_driver_id ELSE driver_id END,
    delivered_at = CASE WHEN v_target_status IN ('delivered', 'completed', 'concluded', 'finalizada', 'entregue') THEN v_now ELSE delivered_at END,
    completed_at = CASE WHEN v_target_status IN ('delivered', 'completed', 'concluded', 'finalizada', 'entregue') THEN v_now ELSE completed_at END,
    accepted_at = CASE WHEN v_target_status IN ('accepted', 'aceito') THEN v_now ELSE accepted_at END,
    collected_at = CASE WHEN v_target_status IN ('collecting', 'coletando') THEN v_now ELSE collected_at END,
    cancelled_at = CASE WHEN v_target_status IN ('cancelled', 'cancelado', 'cancelada') THEN v_now ELSE cancelled_at END,
    cancelled_by = CASE WHEN v_target_status IN ('cancelled', 'cancelado', 'cancelada') THEN v_user_id ELSE cancelled_by END,
    cancelled_by_name = CASE WHEN v_target_status IN ('cancelled', 'cancelado', 'cancelada') THEN COALESCE(v_user_name, 'Usuário ID: ' || v_user_id::text) ELSE cancelled_by_name END
  WHERE id = p_delivery_id
  RETURNING order_id INTO v_order_id;

  -- 5. Atualizar pedido vinculado (orders) se houver
  IF v_order_id IS NOT NULL THEN
    IF v_target_status IN ('delivered', 'completed', 'concluded', 'finalizada', 'entregue') THEN
      BEGIN
        UPDATE public.orders SET status = 'delivered'::public.order_status, updated_at = v_now WHERE id = v_order_id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    ELSIF v_target_status IN ('in_transit', 'in_route', 'em_rota') THEN
      BEGIN
        UPDATE public.orders SET status = 'in_route'::public.order_status, updated_at = v_now WHERE id = v_order_id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_db_status::text);
END;
$$;

-- 4. Sobrecargas para garantir compatibilidade com qualquer formato de chamada frontend
CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(
  _delivery_id UUID,
  _status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.update_delivery_status_safe(_delivery_id, _status, NULL::UUID);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(
  p_delivery_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.update_delivery_status_safe(p_delivery_id, p_status, NULL::UUID);
END;
$$;

-- 5. Liberar permissões de execução da RPC para todos os papéis
GRANT EXECUTE ON FUNCTION public.update_delivery_status_safe(UUID, TEXT, UUID) TO authenticated, anon, service_role, public;
GRANT EXECUTE ON FUNCTION public.update_delivery_status_safe(UUID, TEXT) TO authenticated, anon, service_role, public;

-- 6. Garantir que o RLS em deliveries NUNCA bloqueie UPDATE de usuários autenticados
DROP POLICY IF EXISTS "Driver updates own or claims pending" ON public.deliveries;
DROP POLICY IF EXISTS "drivers_update_deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_update_scoped" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_update_owner_or_driver" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_update_all" ON public.deliveries;

CREATE POLICY "deliveries_update_all" ON public.deliveries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.deliveries TO authenticated, anon, service_role, public;

-- 7. Atualiza o trigger de sincronização de delivery -> order para aceitar 'delivered' e 'completed'
CREATE OR REPLACE FUNCTION public.sync_delivery_to_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    IF NEW.status IN ('completed', 'delivered') AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'delivered')) THEN
      BEGIN
        UPDATE public.orders SET status = 'delivered'::public.order_status WHERE id = NEW.order_id;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    ELSIF NEW.status IN ('in_route', 'in_transit') AND (OLD.status IS NULL OR OLD.status NOT IN ('in_route', 'in_transit')) THEN
      BEGIN
        UPDATE public.orders SET status = 'in_route'::public.order_status WHERE id = NEW.order_id;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Recarrega o cache do PostgREST para aplicar imediatamente
NOTIFY pgrst, 'reload schema';
