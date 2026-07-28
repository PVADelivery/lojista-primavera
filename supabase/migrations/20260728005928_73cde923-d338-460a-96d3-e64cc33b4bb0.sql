
-- 1. Revoke anon EXECUTE on SECURITY DEFINER helper
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO authenticated;

-- 2. Enable RLS on companies (policies already exist)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 3. Enable RLS on deliveries + policies
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deliveries_select_scoped ON public.deliveries;
CREATE POLICY deliveries_select_scoped ON public.deliveries
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS deliveries_insert_scoped ON public.deliveries;
CREATE POLICY deliveries_insert_scoped ON public.deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS deliveries_update_scoped ON public.deliveries;
CREATE POLICY deliveries_update_scoped ON public.deliveries
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS deliveries_delete_admin ON public.deliveries;
CREATE POLICY deliveries_delete_admin ON public.deliveries
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Enable RLS on ride_requests + policies
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ride_requests_select_scoped ON public.ride_requests;
CREATE POLICY ride_requests_select_scoped ON public.ride_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ride_requests_update_scoped ON public.ride_requests;
CREATE POLICY ride_requests_update_scoped ON public.ride_requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
    OR driver_id IN (SELECT id FROM public.delivery_drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ride_requests_delete_admin ON public.ride_requests;
CREATE POLICY ride_requests_delete_admin ON public.ride_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Restrict business_directory reads to authenticated users (contains phone/whatsapp/address)
DROP POLICY IF EXISTS business_directory_public_read ON public.business_directory;
CREATE POLICY business_directory_authenticated_read ON public.business_directory
  FOR SELECT TO authenticated
  USING (true);

-- 6. Consolidate products SELECT policies
DROP POLICY IF EXISTS "Products are publicly readable" ON public.products;
DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_select_public_active ON public.products;
DROP POLICY IF EXISTS products_delete ON public.products;
DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS products_update ON public.products;

CREATE POLICY products_select_active_public ON public.products
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY products_select_authenticated ON public.products
  FOR SELECT TO authenticated
  USING (
    is_active = true
    OR public.user_owns_company(company_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 7. Fix wallets update policy — owner + admin (was admin-only despite the name)
DROP POLICY IF EXISTS wallets_update_own ON public.wallets;
CREATE POLICY wallets_update_own ON public.wallets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
