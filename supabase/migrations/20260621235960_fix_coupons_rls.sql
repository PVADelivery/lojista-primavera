BEGIN;

-- Allow anon and authenticated users to read active coupons
DROP POLICY IF EXISTS "coupons_select_public" ON public.coupons;
CREATE POLICY "coupons_select_public" ON public.coupons
  FOR SELECT TO public
  USING (active = true);

-- Allow anon and authenticated users to read coupon_products
DROP POLICY IF EXISTS "coupon_products_select_public" ON public.coupon_products;
CREATE POLICY "coupon_products_select_public" ON public.coupon_products
  FOR SELECT TO public
  USING (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
