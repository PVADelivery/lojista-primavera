
-- 1. user_roles: only admins may INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "users_insert_own_role" ON public.user_roles;
DROP POLICY IF EXISTS "users_update_own_role" ON public.user_roles;

CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. invitations: remove public read
DROP POLICY IF EXISTS "invitations_public_read" ON public.invitations;

-- 3. system_invitations: remove public read
DROP POLICY IF EXISTS "system_invitations_public_read" ON public.system_invitations;

-- 4. profiles: prevent role/status escalation via Profiles_Final_Update
DROP POLICY IF EXISTS "Profiles_Final_Update" ON public.profiles;
CREATE POLICY "Profiles_Final_Update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND NOT (role IS DISTINCT FROM (SELECT p2.role FROM public.profiles p2 WHERE p2.user_id = auth.uid()))
    AND NOT (status IS DISTINCT FROM (SELECT p2.status FROM public.profiles p2 WHERE p2.user_id = auth.uid()))
  );

-- 5. companies: restrict PII columns from anonymous users
REVOKE SELECT ON public.companies FROM anon;
GRANT SELECT (
  id, user_id, name, category, description, logo_url, cover_url, banner_url, gallery,
  is_active, show_in_marketplace, is_open, active, city_id, city, state, region_id,
  latitude, longitude, delivery_fee, delivery_mode, delivery_regions_pricing,
  prep_time, prep_time_min, prep_time_max, rating, opening_hours, business_hours,
  address, created_at, updated_at
) ON public.companies TO anon;

-- 6. Restrict SECURITY DEFINER function EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_profile_role(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_safe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_company_safe() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_driver(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_driver_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_delivery_on_order_ready() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_delivery_to_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_driver_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_order_ready_automation() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_admin_user(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text, text, text, text, text, uuid, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text, text, text, text, text, uuid, double precision, double precision, text, text, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invitation(text, text, uuid, uuid, timestamptz) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_delivery_status_safe(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order_v3(jsonb, uuid, uuid, text, text, text, boolean, numeric, text, numeric) FROM PUBLIC, anon;

-- 7. Storage policies
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "store_assets_public_read" ON storage.objects;
CREATE POLICY "store_assets_public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "store_assets_owner_insert" ON storage.objects;
CREATE POLICY "store_assets_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "store_assets_owner_update" ON storage.objects;
CREATE POLICY "store_assets_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'store-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "store_assets_owner_delete" ON storage.objects;
CREATE POLICY "store_assets_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "occurrences_owner_select" ON storage.objects;
CREATE POLICY "occurrences_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'occurrences' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::public.app_role)));

DROP POLICY IF EXISTS "occurrences_owner_insert" ON storage.objects;
CREATE POLICY "occurrences_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'occurrences' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "occurrences_owner_update" ON storage.objects;
CREATE POLICY "occurrences_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'occurrences' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'occurrences' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "occurrences_owner_delete" ON storage.objects;
CREATE POLICY "occurrences_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'occurrences' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::public.app_role)));
