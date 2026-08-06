REVOKE EXECUTE ON FUNCTION public.get_public_companies() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_public_companies() TO authenticated, service_role;