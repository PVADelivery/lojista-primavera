
ALTER FUNCTION public.notify_driver_trigger() SET search_path = public;

DROP POLICY IF EXISTS "cities_insert_all" ON public.cities;
DROP POLICY IF EXISTS "cities_update_all" ON public.cities;
DROP POLICY IF EXISTS "cities_delete_all" ON public.cities;

CREATE POLICY "cities_insert_admin" ON public.cities
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cities_update_admin" ON public.cities
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cities_delete_admin" ON public.cities
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
