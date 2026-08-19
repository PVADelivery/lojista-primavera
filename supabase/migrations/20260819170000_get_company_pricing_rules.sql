-- Função RPC Segura para Leitura das Regras de Preço da Empresa (Bypassing RLS)

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
  -- 1. Buscar a tabela de preços vinculada à empresa
  SELECT c.pricing_table_id INTO v_table_id
    FROM public.companies c
   WHERE c.id = p_company_id;

  -- 2. Se a empresa não tem tabela própria vinculada, busca a tabela marcada como padrão
  IF v_table_id IS NULL THEN
    SELECT pt.id INTO v_table_id
      FROM public.pricing_tables pt
     WHERE pt.is_default = true
     LIMIT 1;
  END IF;

  IF v_table_id IS NULL THEN
    RETURN;
  END IF;

  -- 3. Retornar as regras de preço cadastradas para a tabela
  RETURN QUERY
  SELECT pr.pricing_table_id, pr.origin_region_id, pr.destination_region_id, pr.base_value
    FROM public.pricing_rules pr
   WHERE pr.pricing_table_id = v_table_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_pricing_rules(UUID) TO authenticated, anon, public;
NOTIFY pgrst, 'reload schema';
