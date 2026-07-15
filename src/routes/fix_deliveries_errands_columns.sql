-- Execute esse comando SQL no Supabase -> SQL Editor para criar as colunas de coordenadas e endereços que estão faltando na tabela de entregas (deliveries).

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_address text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS is_customer_errand boolean DEFAULT false;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_latitude double precision;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_longitude double precision;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_latitude double precision;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_longitude double precision;
