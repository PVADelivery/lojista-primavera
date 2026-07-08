
-- delivery_drivers: restrict SELECT
DROP POLICY IF EXISTS "delivery_drivers read all" ON public.delivery_drivers;
CREATE POLICY "delivery_drivers read scoped" ON public.delivery_drivers
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.driver_id = delivery_drivers.user_id
      AND user_owns_company(d.company_id)
  )
);

-- motoboys: restrict SELECT
DROP POLICY IF EXISTS "motoboys read" ON public.motoboys;
CREATE POLICY "motoboys read scoped" ON public.motoboys
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- products: restrict SELECT
DROP POLICY IF EXISTS "products read" ON public.products;
CREATE POLICY "products read scoped" ON public.products
FOR SELECT TO authenticated
USING (
  is_active = true
  OR user_owns_company(company_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- regions: restrict SELECT
DROP POLICY IF EXISTS "regions read all" ON public.regions;
CREATE POLICY "regions read scoped" ON public.regions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'company'::app_role)
  OR has_role(auth.uid(), 'driver'::app_role)
);

-- store-assets: enforce ownership on upload
DROP POLICY IF EXISTS "store-assets upload" ON storage.objects;
CREATE POLICY "store-assets upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Prevent broad listing of public buckets via API
DROP POLICY IF EXISTS "store-assets read" ON storage.objects;
DROP POLICY IF EXISTS "avatars read" ON storage.objects;
-- Public buckets remain publicly accessible via public URLs; API listing is now blocked.

-- Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

-- Switch helper functions from DEFINER to INVOKER (rely on RLS)
CREATE OR REPLACE FUNCTION public.update_delivery_status_safe(_delivery_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.deliveries SET status = _status::delivery_status, updated_at = now() WHERE id = _delivery_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_region_for_point(_lat numeric, _lng numeric)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT id FROM public.regions ORDER BY created_at LIMIT 1;
$function$;

-- Revoke EXECUTE from anon on all public SECURITY DEFINER functions and trigger functions
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.user_owns_company(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_delivery_status_safe(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.find_region_for_point(numeric, numeric) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_owns_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_delivery_status_safe(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_region_for_point(numeric, numeric) TO authenticated, service_role;
