-- =========================================================================
-- MIGRATION: Desativar chamada automática de entregador ao marcar pedido como "Pronto"
-- e Criar tabela de Fluxo de Caixa do Lojista (company_cash_flow)
-- =========================================================================

DROP TRIGGER IF EXISTS trg_order_ready_automation ON public.orders;
DROP TRIGGER IF EXISTS trg_create_delivery_on_order_ready ON public.orders;
DROP TRIGGER IF EXISTS trg_auto_dispatch_order ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_ready_delivery ON public.orders;
DROP TRIGGER IF EXISTS "Notificar_Entregador" ON public.orders;

CREATE OR REPLACE FUNCTION public.handle_order_ready_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN NEW;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.company_cash_flow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Geral',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_cash_flow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_cash_flow_merchant_all" ON public.company_cash_flow;
CREATE POLICY "company_cash_flow_merchant_all" ON public.company_cash_flow
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.company_cash_flow TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
