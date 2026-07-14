
REVOKE EXECUTE ON FUNCTION public.get_user_company_ids(uuid) FROM anon, PUBLIC;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.ride_requests;
CREATE POLICY "Users can create own ride requests"
ON public.ride_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
