
-- companies: remove public/broad read exposing PII
DROP POLICY IF EXISTS "companies_public_read" ON public.companies;
REVOKE ALL ON public.companies FROM anon;

-- business_directory: limit authenticated reads to showcase columns
REVOKE ALL ON public.business_directory FROM authenticated;
REVOKE ALL ON public.business_directory FROM anon;
GRANT SELECT (id, name, category, website, hours, rating, featured, card_image_url, card_style, created_at, updated_at)
  ON public.business_directory TO authenticated;
GRANT ALL ON public.business_directory TO service_role;
