-- Adiciona city_id na tabela delivery_drivers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_drivers' AND column_name='city_id') THEN
    ALTER TABLE public.delivery_drivers ADD COLUMN city_id UUID REFERENCES public.cities(id);
  END IF;
END
$$;

-- Adiciona city_id na view de deliveries (se existir e precisar)
-- E garantir o trigger de preenchimento automático para novas entregas
CREATE OR REPLACE FUNCTION set_delivery_city_id_from_company()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.city_id IS NULL AND NEW.company_id IS NOT NULL THEN
    SELECT city_id INTO NEW.city_id FROM public.companies WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_delivery_city_id ON public.deliveries;
CREATE TRIGGER trg_set_delivery_city_id
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION set_delivery_city_id_from_company();
