-- Revoke anon EXECUTE on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_profile_role(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_safe() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_company_safe() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_driver(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_profile_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver(uuid) TO authenticated;

-- Tighten reviews SELECT: restrict to participants (customer, company owner, driver) or admin
DROP POLICY IF EXISTS reviews_select_all ON public.reviews;
CREATE POLICY reviews_select_scoped ON public.reviews
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      LEFT JOIN public.orders o ON o.id = d.order_id
      LEFT JOIN public.customers c ON c.id = o.customer_id
      LEFT JOIN public.companies co ON co.id = d.company_id
      WHERE d.id = reviews.delivery_id
        AND (
          o.user_id = auth.uid()
          OR c.user_id = auth.uid()
          OR co.user_id = auth.uid()
          OR d.driver_id = public.get_driver_id(auth.uid())
        )
    )
  );