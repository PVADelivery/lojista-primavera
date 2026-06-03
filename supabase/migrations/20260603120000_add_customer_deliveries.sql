-- Permitir que corridas avulsas de clientes não precisem estar vinculadas a uma loja
ALTER TABLE public.deliveries ALTER COLUMN company_id DROP NOT NULL;

-- Adicionar colunas para endereço de coleta e identificador de corrida de cliente
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS is_customer_errand BOOLEAN DEFAULT false;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);
