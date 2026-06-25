
ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'broadcasted' AFTER 'pending';


ALTER TABLE public.delivery_drivers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';


CREATE OR REPLACE FUNCTION public.get_driver_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.delivery_drivers WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_driver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_drivers WHERE user_id = _user_id AND status = 'active');
$$;


-- 1. Fix companies_public_pii_exposure
REVOKE SELECT ON public.companies FROM anon;
GRANT SELECT (
  id, name, logo_url, banner_url, cover_url, description, category,
  rating, is_active, active, is_open, opening_hours, business_hours,
  delivery_fee, delivery_mode, latitude, longitude, city, state, city_id,
  region_id, show_in_marketplace, gallery, prep_time, prep_time_min, prep_time_max,
  delivery_regions_pricing, pricing_table_id, created_at, updated_at
) ON public.companies TO anon;

-- 2. Fix deliveries_pending_broadcast_pii_leak
DROP POLICY IF EXISTS deliveries_driver_access ON public.deliveries;
CREATE POLICY deliveries_driver_access ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    (driver_id IS NOT NULL AND driver_id = public.get_driver_id(auth.uid()))
    OR (
      driver_id IS NULL
      AND status IN ('pending'::public.delivery_status, 'broadcasted'::public.delivery_status)
      AND EXISTS (
        SELECT 1 FROM public.delivery_drivers dd
        WHERE dd.user_id = auth.uid() AND dd.status = 'active'
      )
    )
  );

-- 3. Fix has_profile_role_wrong_source
CREATE OR REPLACE FUNCTION public.has_profile_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  );
$$;



