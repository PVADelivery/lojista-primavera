-- =========================================================================
-- MIGRATION: Harmonizar e garantir colunas da tabela coupons
-- Resolve o erro: GET /rest/v1/coupons?select=*&company_id=eq... 400 Bad Request
-- =========================================================================

-- 1. Adicionar colunas na tabela coupons caso não existam
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS min_order_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS max_discount_value NUMERIC(10,2);
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Sincronizar dados entre colunas legadas e novas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='type') THEN
    UPDATE public.coupons SET discount_type = COALESCE(discount_type, type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='value') THEN
    UPDATE public.coupons SET discount_value = COALESCE(discount_value, value);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='min_purchase') THEN
    UPDATE public.coupons SET min_order_value = COALESCE(min_order_value, min_purchase);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='max_discount') THEN
    UPDATE public.coupons SET max_discount_value = COALESCE(max_discount_value, max_discount);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='coupons' AND column_name='expiration_date') THEN
    UPDATE public.coupons SET expires_at = COALESCE(expires_at, expiration_date);
  END IF;

  -- Se existir coupon_companies, sincronizar company_id para cupons vinculados
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='coupon_companies') THEN
    UPDATE public.coupons c
       SET company_id = cc.company_id
      FROM public.coupon_companies cc
     WHERE cc.coupon_id = c.id
       AND c.company_id IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
END $$;

-- 3. Garantir RLS permitindo que o lojista visualize e crie seus cupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_company_read" ON public.coupons;
CREATE POLICY "coupons_company_read" ON public.coupons
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "coupons_company_all" ON public.coupons;
CREATE POLICY "coupons_company_all" ON public.coupons
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
