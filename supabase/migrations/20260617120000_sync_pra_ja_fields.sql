-- Migration to sync missing columns from Pra Já Delivery to Primavera Delivery

-- 1. Sync 'companies' table missing columns
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS delivery_regions_pricing JSONB,
ADD COLUMN IF NOT EXISTS gallery JSONB,
ADD COLUMN IF NOT EXISTS opening_hours JSONB,
ADD COLUMN IF NOT EXISTS show_in_marketplace BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS delivery_mode TEXT,
ADD COLUMN IF NOT EXISTS rating NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC,
ADD COLUMN IF NOT EXISTS prep_time INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS prep_time_min INTEGER,
ADD COLUMN IF NOT EXISTS prep_time_max INTEGER,
ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS email TEXT, ADD COLUMN IF NOT EXISTS document TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- 2. Sync 'deliveries' table missing columns
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS assignment_type TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_cpf TEXT,
ADD COLUMN IF NOT EXISTS difficulty TEXT,
ADD COLUMN IF NOT EXISTS distance_km NUMERIC,
ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER,

ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS estimated_value NUMERIC;

-- 3. Additional missing tables (e.g. app_settings, cities)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: regions table probably exists if it's referenced, but double checking
CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    city_id UUID REFERENCES public.cities(id),
    polygon JSONB,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS business_hours JSONB,
  ADD COLUMN IF NOT EXISTS city_id UUID,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID;

