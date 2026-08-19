-- Liberar permissões de leitura pública e RLS para pricing_tables e pricing_rules
-- Permite que lojas (lojistas), entregadores e clientes leiam as tabelas e regras de preço personalizadas atreladas às empresas

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.pricing_tables TO anon, authenticated, public;
GRANT SELECT ON public.pricing_rules TO anon, authenticated, public;

ALTER TABLE public.pricing_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_tables_public_read" ON public.pricing_tables;
CREATE POLICY "pricing_tables_public_read"
ON public.pricing_tables
FOR SELECT
TO anon, authenticated, public
USING (true);

DROP POLICY IF EXISTS "pricing_rules_public_read" ON public.pricing_rules;
CREATE POLICY "pricing_rules_public_read"
ON public.pricing_rules
FOR SELECT
TO anon, authenticated, public
USING (true);
