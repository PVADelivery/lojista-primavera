-- 1) Revoke anon execute on SECURITY DEFINER credit function
REVOKE EXECUTE ON FUNCTION public.add_company_credits(uuid, numeric, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_company_credits(uuid, numeric, text, text, text) TO authenticated;

-- 2) Companies: remove blanket public read of all columns
DROP POLICY IF EXISTS "Lojas visíveis publicamente" ON public.companies;

REVOKE ALL ON public.companies FROM anon;
GRANT SELECT (
  id, name, logo_url, cover_url, banner_url, category, description, gallery,
  opening_hours, business_hours, rating, delivery_fee, prep_time, prep_time_min,
  prep_time_max, delivery_mode, is_active, is_open, show_in_marketplace,
  region_id, city_id, city, state, latitude, longitude, created_at
) ON public.companies TO anon;

CREATE POLICY "Vitrine pública de lojas ativas"
ON public.companies
FOR SELECT
TO anon
USING (is_active IS TRUE AND COALESCE(show_in_marketplace, true) IS TRUE);

-- 3) Views must run with the querying user's permissions (no SECURITY DEFINER views)
ALTER VIEW public.public_companies SET (security_invoker = true);
ALTER VIEW public.companies_public SET (security_invoker = true);

-- companies_public exposes phone/address: restrict it to the marketplace-safe columns
DROP VIEW IF EXISTS public.companies_public;
CREATE VIEW public.companies_public
WITH (security_invoker = true) AS
SELECT id, name, logo_url, city_id, region_id, latitude, longitude,
       is_active, show_in_marketplace, created_at
FROM public.companies
WHERE show_in_marketplace = true AND COALESCE(is_active, true) = true;

GRANT SELECT ON public.public_companies TO anon, authenticated;
GRANT SELECT ON public.companies_public TO anon, authenticated;