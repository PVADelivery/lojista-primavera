-- ============================================================================
-- SCRIPT DE MIGRAÇÃO: RPC SEGURO PARA VINCULAR EMPRESAS A TABELAS DE PREÇO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_company_pricing_table(
  p_company_id UUID,
  p_pricing_table_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'ID da empresa não informado.';
  END IF;

  UPDATE public.companies
     SET pricing_table_id = p_pricing_table_id,
         updated_at = now()
   WHERE id = p_company_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Empresa não encontrada para atualização.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'pricing_table_id', p_pricing_table_id,
    'updated_rows', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_company_pricing_table(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_pricing_table(UUID, UUID) TO service_role;
