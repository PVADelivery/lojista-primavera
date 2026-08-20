-- COMPANIES: remove public/full-row exposure
DROP POLICY IF EXISTS "companies_public_read" ON public.companies;
REVOKE ALL ON public.companies FROM anon;
REVOKE ALL ON public.companies FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

-- BUSINESS DIRECTORY: explicit column-scoped read for authenticated
DROP POLICY IF EXISTS "business_directory_authenticated_read" ON public.business_directory;
CREATE POLICY "business_directory_showcase_read"
ON public.business_directory FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.business_directory FROM anon;
REVOKE ALL ON public.business_directory FROM authenticated;
GRANT SELECT (id, name, category, website, hours, rating, featured, card_image_url, card_style, created_at, updated_at)
  ON public.business_directory TO authenticated;
GRANT ALL ON public.business_directory TO service_role;
