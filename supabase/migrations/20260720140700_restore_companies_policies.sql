-- Restaura policies corretas para a tabela companies
-- A migration anterior (20260720133943) removeu allow_all mas deixou sem cobertura adequada

-- Garante que o lojista consegue LER sua propria empresa
DROP POLICY IF EXISTS "companies owner read" ON public.companies;
CREATE POLICY "companies owner read" ON public.companies
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'customer'::public.app_role)
    OR public.has_role(auth.uid(), 'driver'::public.app_role)
  );

-- Garante que o lojista consegue ESCREVER/ATUALIZAR sua propria empresa
DROP POLICY IF EXISTS "companies owner write" ON public.companies;
CREATE POLICY "companies owner write" ON public.companies
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Permite que clientes (marketplace) leiam empresas visiveis publicamente
DROP POLICY IF EXISTS "companies marketplace public read" ON public.companies;
CREATE POLICY "companies marketplace public read" ON public.companies
  FOR SELECT
  USING (show_in_marketplace = true);
