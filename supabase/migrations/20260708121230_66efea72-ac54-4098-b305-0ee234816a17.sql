
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS show_in_marketplace boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb;
