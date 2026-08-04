DROP POLICY IF EXISTS "Lojas visíveis publicamente" ON public.companies;

CREATE OR REPLACE VIEW public.public_companies
WITH (security_invoker = off) AS
SELECT
  id, name, logo_url, cover_url, banner_url, category, description,
  gallery, opening_hours, business_hours, rating, delivery_fee,
  prep_time, prep_time_min, prep_time_max, delivery_mode,
  is_active, is_open, show_in_marketplace, region_id, city_id,
  city, state, latitude, longitude, created_at
FROM public.companies
WHERE is_active IS TRUE AND COALESCE(show_in_marketplace, true) IS TRUE;

GRANT SELECT ON public.public_companies TO anon, authenticated;