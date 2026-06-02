
-- ========= companies: colunas extras =========
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS full_name text;

-- ========= deliveries: price =========
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;

-- ========= profiles: role espelho =========
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role app_role;

-- ========= addresses =========
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text,
  street text,
  number text,
  neighborhood text,
  city text,
  state text,
  zipcode text,
  complement text,
  latitude numeric,
  longitude numeric,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses self all" ON public.addresses
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin'));

-- ========= delivery_drivers =========
CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  vehicle text,
  plate text,
  is_online boolean NOT NULL DEFAULT false,
  rating numeric DEFAULT 5.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_drivers TO authenticated;
GRANT ALL ON public.delivery_drivers TO service_role;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_drivers read all" ON public.delivery_drivers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "delivery_drivers self write" ON public.delivery_drivers
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin'));

-- ========= conversations =========
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  delivery_id uuid,
  company_id uuid,
  participants uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations participant all" ON public.conversations
  FOR ALL TO authenticated
  USING (auth.uid() = ANY(participants) OR has_role(auth.uid(),'admin') OR (company_id IS NOT NULL AND user_owns_company(company_id)))
  WITH CHECK (auth.uid() = ANY(participants) OR has_role(auth.uid(),'admin') OR (company_id IS NOT NULL AND user_owns_company(company_id)));

-- ========= messages =========
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages via conversation" ON public.messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id
    AND (auth.uid() = ANY(c.participants) OR has_role(auth.uid(),'admin') OR (c.company_id IS NOT NULL AND user_owns_company(c.company_id)))))
  WITH CHECK (sender_id = auth.uid() OR has_role(auth.uid(),'admin'));

-- ========= chat_messages (entregas) =========
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid,
  sender_id uuid NOT NULL,
  recipient_id uuid,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages party all" ON public.chat_messages
  FOR ALL TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (sender_id = auth.uid() OR has_role(auth.uid(),'admin'));

-- ========= chat_message_logs (suporte) =========
CREATE TABLE IF NOT EXISTS public.chat_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_message_logs TO authenticated;
GRANT ALL ON public.chat_message_logs TO service_role;
ALTER TABLE public.chat_message_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_message_logs party all" ON public.chat_message_logs
  FOR ALL TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR has_role(auth.uid(),'admin'))
  WITH CHECK (sender_id = auth.uid() OR has_role(auth.uid(),'admin'));
