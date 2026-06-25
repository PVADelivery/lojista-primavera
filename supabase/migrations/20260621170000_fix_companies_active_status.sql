BEGIN;

-- Força TODAS as lojas a estarem ativas e visíveis.
-- O único controle de Fechada/Aberta passa a ser estritamente o is_open.
UPDATE public.companies
SET 
  active = true,
  is_active = true,
  show_in_marketplace = true;

COMMIT;

NOTIFY pgrst, 'reload schema';
