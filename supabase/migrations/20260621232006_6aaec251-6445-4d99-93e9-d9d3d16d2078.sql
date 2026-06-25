CREATE OR REPLACE FUNCTION public.set_delivery_city_id_from_company()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.city_id IS NULL AND NEW.company_id IS NOT NULL THEN
    SELECT city_id INTO NEW.city_id FROM public.companies WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$function$;