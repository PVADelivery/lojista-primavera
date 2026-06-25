BEGIN;

-- Assegurar que a tabela cities tem RLS ativo
ALTER TABLE IF EXISTS public.cities ENABLE ROW LEVEL SECURITY;

-- Política de SELECT para todos (anon ou authenticated)
DROP POLICY IF EXISTS "cities_select_all" ON public.cities;
CREATE POLICY "cities_select_all" ON public.cities
  FOR SELECT TO public
  USING (true);

-- Política de INSERT para todos (temporário/admin)
DROP POLICY IF EXISTS "cities_insert_all" ON public.cities;
CREATE POLICY "cities_insert_all" ON public.cities
  FOR INSERT TO public
  WITH CHECK (true);

-- Política de UPDATE para todos
DROP POLICY IF EXISTS "cities_update_all" ON public.cities;
CREATE POLICY "cities_update_all" ON public.cities
  FOR UPDATE TO public
  USING (true);

-- Política de DELETE para todos
DROP POLICY IF EXISTS "cities_delete_all" ON public.cities;
CREATE POLICY "cities_delete_all" ON public.cities
  FOR DELETE TO public
  USING (true);

COMMIT;

NOTIFY pgrst, 'reload schema';
