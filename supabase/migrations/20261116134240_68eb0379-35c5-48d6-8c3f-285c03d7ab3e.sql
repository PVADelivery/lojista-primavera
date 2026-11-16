ALTER FUNCTION public.rpc_deduct_customer_credits(uuid,numeric,text,text,text) SET search_path = '';
ALTER FUNCTION public.rpc_add_customer_credits(uuid,text,text,numeric,numeric,text,text) SET search_path = '';

DROP POLICY IF EXISTS "coupons_global_read" ON public.coupons;
CREATE POLICY "coupons_global_read" ON public.coupons
  FOR SELECT TO authenticated
  USING (company_id IS NULL);

DROP POLICY IF EXISTS "pricing_tables_default_read" ON public.pricing_tables;
CREATE POLICY "pricing_tables_default_read" ON public.pricing_tables
  FOR SELECT TO authenticated
  USING (is_default = true);

DROP POLICY IF EXISTS "pricing_rules_default_read" ON public.pricing_rules;
CREATE POLICY "pricing_rules_default_read" ON public.pricing_rules
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pricing_tables t WHERE t.id = pricing_rules.pricing_table_id AND t.is_default = true));

DROP POLICY IF EXISTS "store_assets_admin_manage" ON storage.objects;
CREATE POLICY "store_assets_admin_manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'store-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "avatars_admin_manage" ON storage.objects;
CREATE POLICY "avatars_admin_manage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'avatars' AND public.has_role(auth.uid(), 'admin'::public.app_role));