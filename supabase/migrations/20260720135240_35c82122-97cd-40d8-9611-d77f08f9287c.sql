
-- 1. Revoke anon EXECUTE on user_owns_company
REVOKE EXECUTE ON FUNCTION public.user_owns_company(uuid) FROM anon, PUBLIC;

-- 2. Tighten delivery_drivers SELECT: companies only see drivers linked via deliveries
DROP POLICY IF EXISTS drivers_select_scoped ON public.delivery_drivers;
CREATE POLICY drivers_select_scoped ON public.delivery_drivers
FOR SELECT USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'company'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.companies c ON c.id = d.company_id
      WHERE d.driver_id = delivery_drivers.id
        AND c.user_id = auth.uid()
    )
  )
);

-- 3. Consolidate platform_cash_flow policies to use user_roles/has_role
DROP POLICY IF EXISTS "Platform admins can delete cash flow" ON public.platform_cash_flow;
DROP POLICY IF EXISTS "Platform admins can insert cash flow" ON public.platform_cash_flow;
DROP POLICY IF EXISTS "Platform admins can update cash flow" ON public.platform_cash_flow;
DROP POLICY IF EXISTS "Platform admins can view cash flow" ON public.platform_cash_flow;
