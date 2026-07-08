
ALTER TABLE public.delivery_drivers
  ADD COLUMN IF NOT EXISTS current_latitude numeric,
  ADD COLUMN IF NOT EXISTS current_longitude numeric;

ALTER TABLE public.regions
  ADD COLUMN IF NOT EXISTS polygon jsonb,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS reference text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS commission_percentage numeric NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS public.company_cash_flow (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('income','expense')),
  date date NOT NULL DEFAULT (now()::date),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_cash_flow TO authenticated;
GRANT ALL ON public.company_cash_flow TO service_role;

ALTER TABLE public.company_cash_flow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_cash_flow owner all" ON public.company_cash_flow
FOR ALL TO authenticated
USING (user_owns_company(company_id) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (user_owns_company(company_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS company_cash_flow_company_id_date_idx
  ON public.company_cash_flow (company_id, date DESC);
