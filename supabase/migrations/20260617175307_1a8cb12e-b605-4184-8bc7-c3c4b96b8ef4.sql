
-- 1. Remove profiles.role fallback in privileged role checks
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_safe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'company'::public.app_role
  );
$$;

-- 2. Drop overly permissive catch-all policies on orders / order_items
DROP POLICY IF EXISTS orders_manage_stable ON public.orders;
DROP POLICY IF EXISTS orders_select_stable ON public.orders;
DROP POLICY IF EXISTS order_items_manage_stable ON public.order_items;
DROP POLICY IF EXISTS order_items_select_stable ON public.order_items;

-- 3. Drop overly permissive customers policy (scoped ones remain)
DROP POLICY IF EXISTS customers_manage_stable ON public.customers;

-- 4. Tighten profiles SELECT: remove blanket company access
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Add WITH CHECK to profiles_update_self to lock role/status
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role IS NOT DISTINCT FROM (SELECT p2.role FROM public.profiles p2 WHERE p2.user_id = auth.uid())
    AND status IS NOT DISTINCT FROM (SELECT p2.status FROM public.profiles p2 WHERE p2.user_id = auth.uid())
  );

-- 6. Hide companies sensitive contact columns from anonymous visitors
REVOKE SELECT (email, phone, document) ON public.companies FROM anon;
