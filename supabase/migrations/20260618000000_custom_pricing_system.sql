-- Create pricing_tables
CREATE TABLE IF NOT EXISTS public.pricing_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pricing_rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_table_id UUID REFERENCES public.pricing_tables(id) ON DELETE CASCADE NOT NULL,
  origin_region_id UUID REFERENCES public.regions(id) ON DELETE CASCADE NOT NULL,
  destination_region_id UUID REFERENCES public.regions(id) ON DELETE CASCADE NOT NULL,
  base_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  return_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pricing_table_id, origin_region_id, destination_region_id)
);

-- Update companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS pricing_table_id UUID REFERENCES public.pricing_tables(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.pricing_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies

-- Admins can do anything
DROP POLICY IF EXISTS "Admins can manage pricing tables" ON public.pricing_tables;
CREATE POLICY "Admins can manage pricing tables" ON public.pricing_tables
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage pricing rules" ON public.pricing_rules;
CREATE POLICY "Admins can manage pricing rules" ON public.pricing_rules
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Companies can view ONLY their assigned pricing table (or the default one if they have none)
DROP POLICY IF EXISTS "Companies can view their pricing tables" ON public.pricing_tables;
CREATE POLICY "Companies can view their pricing tables" ON public.pricing_tables
  FOR SELECT USING (
    id = (SELECT pricing_table_id FROM public.companies WHERE user_id = auth.uid() LIMIT 1)
    OR (is_default = true AND (SELECT pricing_table_id FROM public.companies WHERE user_id = auth.uid() LIMIT 1) IS NULL)
  );

DROP POLICY IF EXISTS "Companies can view their pricing rules" ON public.pricing_rules;
CREATE POLICY "Companies can view their pricing rules" ON public.pricing_rules
  FOR SELECT USING (
    pricing_table_id = (SELECT pricing_table_id FROM public.companies WHERE user_id = auth.uid() LIMIT 1)
    OR (
        pricing_table_id IN (SELECT id FROM public.pricing_tables WHERE is_default = true) 
        AND (SELECT pricing_table_id FROM public.companies WHERE user_id = auth.uid() LIMIT 1) IS NULL
    )
  );

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_pricing_tables_updated_at ON public.pricing_tables;
CREATE TRIGGER update_pricing_tables_updated_at
  BEFORE UPDATE ON public.pricing_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_rules_updated_at ON public.pricing_rules;
CREATE TRIGGER update_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
