-- O usuário já foi criado via API com a criptografia de senha correta.
-- Agora só precisamos dar os acessos de administrador para ele.

DO $$ 
DECLARE
  -- O ID gerado pela API do Supabase agorinha mesmo:
  created_user_id UUID := '11d9803b-3b98-49bd-b1ad-c9ab3b20cd5f'; 
BEGIN

  -- 1. ATUALIZA O PERFIL
  -- O Supabase já criou o perfil, só precisamos dizer que ele é 'admin'
  UPDATE public.profiles 
  SET role = 'admin', full_name = 'Açaí Primavera'
  WHERE user_id = created_user_id;

  -- 2. VINCULA A LOJA
  INSERT INTO public.companies (user_id, name, is_active, is_open)
  VALUES (created_user_id, 'Açaí Primavera Delivery', true, true)
  ON CONFLICT DO NOTHING;

END $$;
