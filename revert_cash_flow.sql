-- SCRIPT DE REVERSÃO PARA O PROJETO "É PRA JÁ"
-- Este script vai desfazer tudo que os scripts anteriores criaram por engano.

DO $$ 
DECLARE
  wrong_user_id UUID := 'b12b571a-a866-4285-8e17-73704e7aa791'; 
BEGIN
  -- 1. Remove a tabela do fluxo de caixa que foi criada no projeto errado (se existir)
  DROP TABLE IF EXISTS public.company_cash_flow CASCADE;

  -- 2. Remove a loja teste
  DELETE FROM public.companies WHERE user_id = wrong_user_id;

  -- 3. Remove o profile de administrador teste
  DELETE FROM public.profiles WHERE user_id = wrong_user_id;

  -- 4. Remove a identidade de autenticação
  DELETE FROM auth.identities WHERE user_id = wrong_user_id;

  -- 5. Remove o usuário teste da tabela de autenticação
  DELETE FROM auth.users WHERE id = wrong_user_id;
END $$;
