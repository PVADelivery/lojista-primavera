-- Script Definitivo para Liberar e Aplicar Tabelas de Preço Personalizadas no Painel do Lojista

-- 1. Liberar permissões de leitura pública (RLS) para pricing_tables e pricing_rules
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

-- 2. Criar/Atualizar Função RPC Segura para Leitura das Regras de Preço da Empresa (Bypassing RLS)
CREATE OR REPLACE FUNCTION public.get_company_pricing_rules(p_company_id UUID)
RETURNS TABLE (
  pricing_table_id UUID,
  origin_region_id UUID,
  destination_region_id UUID,
  base_value NUMERIC(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id UUID;
BEGIN
  -- Buscar a tabela de preços personalizada vinculada à empresa
  SELECT c.pricing_table_id INTO v_table_id
    FROM public.companies c
   WHERE c.id = p_company_id;

  -- Se a empresa não tem tabela própria vinculada, busca a tabela marcada como padrão
  IF v_table_id IS NULL THEN
    SELECT pt.id INTO v_table_id
      FROM public.pricing_tables pt
     WHERE pt.is_default = true
     LIMIT 1;
  END IF;

  IF v_table_id IS NULL THEN
    RETURN;
  END IF;

  -- Retornar as regras de preço cadastradas para a tabela
  RETURN QUERY
  SELECT pr.pricing_table_id, pr.origin_region_id, pr.destination_region_id, pr.base_value
    FROM public.pricing_rules pr
   WHERE pr.pricing_table_id = v_table_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_pricing_rules(UUID) TO authenticated, anon, public;
NOTIFY pgrst, 'reload schema';
