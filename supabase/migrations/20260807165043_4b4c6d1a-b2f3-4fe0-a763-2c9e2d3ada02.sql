-- ============ DELIVERIES ============
DROP POLICY IF EXISTS "Permitir select geral para authenticated em deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Permitir insert geral para authenticated em deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Permitir update geral para authenticated em deliveries" ON public.deliveries;

CREATE POLICY "deliveries_scoped_select" ON public.deliveries
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.user_owns_company(company_id)
  OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
  OR (driver_id IS NULL AND public.get_driver_id(auth.uid()) IS NOT NULL AND status IN ('pending','broadcasted'))
  OR (customer_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.customers c WHERE c.id = deliveries.customer_id AND c.user_id = auth.uid()))
  OR (order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = deliveries.order_id AND o.user_id = auth.uid()))
);

CREATE POLICY "deliveries_scoped_insert" ON public.deliveries
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.user_owns_company(company_id)
);

CREATE POLICY "deliveries_scoped_update" ON public.deliveries
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.user_owns_company(company_id)
  OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
  OR (driver_id IS NULL AND public.get_driver_id(auth.uid()) IS NOT NULL)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.user_owns_company(company_id)
  OR (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
);

REVOKE ALL ON public.deliveries FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;

-- ============ COMPANIES (public showcase columns only for anon) ============
REVOKE ALL ON public.companies FROM PUBLIC;
REVOKE ALL ON public.companies FROM anon;
GRANT SELECT (
  id, name, category, description, logo_url, cover_url, banner_url, gallery,
  rating, delivery_fee, prep_time, prep_time_min, prep_time_max,
  opening_hours, business_hours, is_open, is_active, show_in_marketplace,
  city, state, city_id, region_id, delivery_mode, created_at
) ON public.companies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

-- ============ BUSINESS DIRECTORY ============
DROP POLICY IF EXISTS "business_directory_authenticated_read" ON public.business_directory;
CREATE POLICY "business_directory_authenticated_read" ON public.business_directory
FOR SELECT TO authenticated
USING (true);

REVOKE ALL ON public.business_directory FROM PUBLIC;
REVOKE ALL ON public.business_directory FROM anon;
GRANT SELECT (
  id, name, category, website, hours, rating, featured,
  card_image_url, card_style, created_at, updated_at
) ON public.business_directory TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_directory TO authenticated;
GRANT ALL ON public.business_directory TO service_role;

-- Admin-only access to directory contact details
CREATE OR REPLACE FUNCTION public.get_business_directory_contacts()
RETURNS TABLE(id uuid, phone text, whatsapp text, address text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id, b.phone, b.whatsapp, b.address
  FROM public.business_directory b
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.get_business_directory_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_business_directory_contacts() TO authenticated, service_role;