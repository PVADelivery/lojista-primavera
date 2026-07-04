-- 1. Defina o ID do novo usuário
-- Vamos usar o UUID que você tentou usar antes para manter o padrão
DO $$ 
DECLARE
  new_user_id UUID := 'b12b571a-a866-4285-8e17-73704e7aa791'; 
BEGIN

  -- 2. Insere o usuário diretamente na tabela de autenticação do Supabase
  -- Email: admin@primavera.com
  -- Senha: password123
  INSERT INTO auth.users (
    id, 
    instance_id, 
    aud, 
    role, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at
  )
  VALUES (
    new_user_id, 
    '00000000-0000-0000-0000-000000000000', 
    'authenticated', 
    'authenticated', 
    'admin@primavera.com', 
    crypt('password123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now()
  ) ON CONFLICT (id) DO NOTHING;

  -- 3. Insere a identidade do usuário (necessário no Supabase)
  INSERT INTO auth.identities (
    id, 
    user_id, 
    identity_data, 
    provider,
    provider_id,
    created_at, 
    updated_at
  )
  VALUES (
    gen_random_uuid(), 
    new_user_id, 
    format('{"sub":"%s","email":"%s"}', new_user_id::text, 'admin@primavera.com')::jsonb, 
    'email', 
    new_user_id::text,
    now(), 
    now()
  ) ON CONFLICT DO NOTHING;

  -- 4. Cria o Profile (Perfil) definindo-o como 'admin'
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (new_user_id, 'Admin Teste', 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  -- 5. Cria uma Loja (Company) vinculada a este usuário para ele ver o painel
  INSERT INTO public.companies (user_id, name, is_active, is_open)
  VALUES (new_user_id, 'Loja Teste Primavera', true, true)
  ON CONFLICT DO NOTHING;

END $$;
