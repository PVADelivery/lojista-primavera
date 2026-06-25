BEGIN;

-- 1. Restore access to all columns on companies for anon to fix SELECT * failures
GRANT SELECT ON public.companies TO anon;

-- 2. Optimize companies RLS to remove expensive EXISTS queries for unauthenticated visitors
DROP POLICY IF EXISTS "Anyone can view active and visible companies" ON public.companies;
DROP POLICY IF EXISTS "companies_select_public" ON public.companies;
DROP POLICY IF EXISTS "companies_select_stable" ON public.companies;

CREATE POLICY "Anyone can view active and visible companies" ON public.companies
  FOR SELECT TO public
  USING (
    (is_active = true AND show_in_marketplace = true)
    OR (auth.uid() = user_id)
    OR (
      CASE 
        WHEN auth.role() = 'authenticated' THEN public.has_role(auth.uid(), 'admin'::public.app_role)
        ELSE false
      END
    )
  );

-- 3. Optimize products RLS to ensure it doesn't do expensive checks for anon
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_select_public" ON public.products;

CREATE POLICY "products_select_policy" ON public.products
  FOR SELECT TO public
  USING (
    is_active = true
    OR (auth.role() = 'authenticated')
  );

-- 4. Restore fast orders policy just in case the marketplace fetches orders
DROP POLICY IF EXISTS orders_select_stable ON public.orders;
CREATE POLICY "orders_select_stable" ON public.orders
  FOR SELECT TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR (
      CASE 
        WHEN auth.role() = 'authenticated' THEN public.has_role(auth.uid(), 'admin'::public.app_role)
        ELSE false
      END
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
