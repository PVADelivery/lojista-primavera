
-- 1. system_error_logs: enable RLS, admin-only read
ALTER TABLE public.system_error_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_error_logs FROM anon, authenticated, PUBLIC;
GRANT INSERT ON public.system_error_logs TO authenticated;
GRANT SELECT, INSERT ON public.system_error_logs TO service_role;

DROP POLICY IF EXISTS system_error_logs_admin_select ON public.system_error_logs;
CREATE POLICY system_error_logs_admin_select ON public.system_error_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS system_error_logs_insert_own ON public.system_error_logs;
CREATE POLICY system_error_logs_insert_own ON public.system_error_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 2. view_financial_summary: security_invoker + no anon access
ALTER VIEW public.view_financial_summary SET (security_invoker = true);
REVOKE ALL ON public.view_financial_summary FROM anon, PUBLIC;
GRANT SELECT ON public.view_financial_summary TO authenticated, service_role;

-- 3. business_directory: hide contact columns from regular authenticated users
REVOKE ALL ON public.business_directory FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, name, category, website, hours, rating, featured, card_image_url, card_style, created_at, updated_at)
  ON public.business_directory TO authenticated;
GRANT ALL ON public.business_directory TO service_role;
