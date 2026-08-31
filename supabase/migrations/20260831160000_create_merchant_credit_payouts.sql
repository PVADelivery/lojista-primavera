-- =========================================================================
-- MIGRATION: Gestão de Repasses de Vendas em Créditos do Marketplace
-- =========================================================================

-- 1. Criar tabela de Repasses de Créditos para Lojistas
CREATE TABLE IF NOT EXISTS public.merchant_credit_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'cancelled')),
  order_ids JSONB DEFAULT '[]'::jsonb,
  pix_key TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Adicionar colunas de controle de repasse na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES public.merchant_credit_payouts(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payout_at TIMESTAMPTZ;

-- 3. Habilitar RLS na tabela merchant_credit_payouts
ALTER TABLE public.merchant_credit_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_credit_payouts_admin_all" ON public.merchant_credit_payouts;
CREATE POLICY "merchant_credit_payouts_admin_all" ON public.merchant_credit_payouts
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Função RPC segura para o Admin processar e liquidar um repasse
CREATE OR REPLACE FUNCTION public.process_merchant_credit_payout(
  p_company_id UUID,
  p_order_ids UUID[],
  p_amount NUMERIC,
  p_pix_key TEXT DEFAULT NULL,
  p_receipt_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payout_id UUID;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Checar privilégios de Admin
  BEGIN
    v_is_admin := public.is_admin_safe();
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF NOT v_is_admin THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    ) INTO v_is_admin;
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem registrar repasses.');
  END IF;

  -- 1. Criar registro de repasse
  INSERT INTO public.merchant_credit_payouts (
    company_id,
    amount,
    status,
    order_ids,
    pix_key,
    receipt_url,
    notes,
    created_by,
    paid_at
  ) VALUES (
    p_company_id,
    p_amount,
    'paid',
    to_jsonb(p_order_ids),
    p_pix_key,
    p_receipt_url,
    p_notes,
    auth.uid(),
    now()
  ) RETURNING id INTO v_payout_id;

  -- 2. Atualizar status dos pedidos vinculados
  IF p_order_ids IS NOT NULL AND array_length(p_order_ids, 1) > 0 THEN
    UPDATE public.orders
       SET payout_status = 'paid',
           payout_id = v_payout_id,
           payout_at = now()
     WHERE id = ANY(p_order_ids)
       AND company_id = p_company_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'orders_count', COALESCE(array_length(p_order_ids, 1), 0),
    'amount', p_amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.process_merchant_credit_payout(UUID, UUID[], NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
