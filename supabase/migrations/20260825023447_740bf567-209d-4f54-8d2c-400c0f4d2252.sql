-- 1. delivery_drivers: remover política permissiva pública e garantir acesso admin
DROP POLICY IF EXISTS "Permitir delecao total de motoristas" ON public.delivery_drivers;

DROP POLICY IF EXISTS "drivers_admin_all" ON public.delivery_drivers;
CREATE POLICY "drivers_admin_all"
ON public.delivery_drivers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. profiles: remover política permissiva pública e garantir acesso admin
DROP POLICY IF EXISTS "Permitir atualizacao de perfis pelo admin" ON public.profiles;

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all"
ON public.profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. user_roles: remover política permissiva pública (políticas admin já existem)
DROP POLICY IF EXISTS "Permitir delecao total em user_roles" ON public.user_roles;