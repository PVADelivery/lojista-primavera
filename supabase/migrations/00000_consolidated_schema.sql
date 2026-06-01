-- =============================================
-- RESET DATABASE (DROP EXISTING)
-- =============================================
DROP TABLE IF EXISTS public.invitations CASCADE;
DROP TABLE IF EXISTS public.occurrences CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.deliveries CASCADE;
DROP TABLE IF EXISTS public.addresses CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.delivery_drivers CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.regions CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.delivery_status CASCADE;
DROP TYPE IF EXISTS public.occurrence_type CASCADE;
DROP TYPE IF EXISTS public.order_status CASCADE;
DROP TYPE IF EXISTS public.invitation_status CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- =============================================
-- ENUM TYPES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'company', 'driver', 'customer');
CREATE TYPE public.delivery_status AS ENUM ('pending', 'accepted', 'collecting', 'in_route', 'completed', 'cancelled');
CREATE TYPE public.occurrence_type AS ENUM ('motorcycle_issue', 'accident', 'robbery', 'other');
CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'in_route', 'delivered', 'cancelled');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- =============================================
-- TIMESTAMP TRIGGER FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  document TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- USER ROLES TABLE
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- REGIONS TABLE
-- =============================================
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  geometry JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_regions_updated_at
  BEFORE UPDATE ON public.regions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- COMPANIES TABLE
-- =============================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  region_id UUID REFERENCES public.regions(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DELIVERY DRIVERS TABLE
-- =============================================
CREATE TABLE public.delivery_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  vehicle TEXT NOT NULL DEFAULT 'motorcycle',
  license_plate TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- CUSTOMERS TABLE
-- =============================================
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ADDRESSES TABLE
-- =============================================
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  label TEXT DEFAULT 'Casa',
  street TEXT NOT NULL,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT NOT NULL DEFAULT 'Cuiabá',
  state TEXT NOT NULL DEFAULT 'MT',
  zip_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  region_id UUID REFERENCES public.regions(id),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PRODUCTS TABLE
-- =============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DELIVERIES TABLE
-- =============================================
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  driver_id UUID REFERENCES public.delivery_drivers(id),
  order_id UUID,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  region_id UUID REFERENCES public.regions(id),
  status delivery_status NOT NULL DEFAULT 'pending',
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission NUMERIC(10,2) NOT NULL DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  accepted_at TIMESTAMPTZ,
  collected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ORDERS TABLE
-- =============================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  delivery_id UUID REFERENCES public.deliveries(id),
  customer_name TEXT,
  delivery_address TEXT,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  idempotency_key TEXT UNIQUE,
  status order_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTOMATION: ORDER -> DELIVERY
-- =============================================
CREATE OR REPLACE FUNCTION public.create_delivery_on_order_ready()
RETURNS TRIGGER AS $$
DECLARE
  v_delivery_id UUID;
BEGIN
  IF NEW.status = 'ready' AND OLD.status != 'ready' THEN
    -- Criar entrega
    INSERT INTO public.deliveries (
      company_id,
      order_id,
      customer_name,
      address,
      status,
      value
    ) VALUES (
      NEW.company_id,
      NEW.id,
      COALESCE(NEW.customer_name, 'Cliente Marketplace'),
      COALESCE(NEW.delivery_address, 'Endereço não informado'),
      'pending',
      10.00
    ) RETURNING id INTO v_delivery_id;

    -- Atualizar o order com o ID da entrega
    NEW.delivery_id = v_delivery_id;
  END IF;
  
  -- Se o pedido for marcado como entregue (ex: pelo lojista), finalizar entrega se existir
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_id IS NOT NULL THEN
     UPDATE public.deliveries SET status = 'completed' WHERE id = NEW.delivery_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_order_ready_create_delivery
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_delivery_on_order_ready();

-- =============================================
-- AUTOMATION: DELIVERY -> ORDER
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_delivery_to_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      UPDATE public.orders SET status = 'delivered' WHERE id = NEW.order_id;
    END IF;
    IF NEW.status = 'in_route' AND OLD.status != 'in_route' THEN
      UPDATE public.orders SET status = 'in_route' WHERE id = NEW.order_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_delivery_status_change_update_order
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_to_order();


-- =============================================
-- ORDER ITEMS TABLE
-- =============================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- REVIEWS TABLE
-- =============================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) NOT NULL,
  driver_id UUID REFERENCES public.delivery_drivers(id) NOT NULL,
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OCCURRENCES TABLE
-- =============================================
CREATE TABLE public.occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.delivery_drivers(id) NOT NULL,
  delivery_id UUID REFERENCES public.deliveries(id),
  type occurrence_type NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.occurrences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_occurrences_updated_at
  BEFORE UPDATE ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INVITATIONS TABLE
-- =============================================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES (Simplified & Performant)
-- =============================================

-- Profiles
CREATE POLICY "Profiles_Final_Select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles_Final_Update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Profiles_Final_Insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles
CREATE POLICY "user_roles_read_all" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Regions
CREATE POLICY "regions_select_all" ON public.regions FOR SELECT TO authenticated USING (true);

-- Companies
CREATE POLICY "companies_select_all" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies_update_own" ON public.companies FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "companies_insert_own" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Delivery Drivers
CREATE POLICY "Drivers_Final_Select" ON public.delivery_drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers_Final_Update" ON public.delivery_drivers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Drivers_Final_Insert" ON public.delivery_drivers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Customers
CREATE POLICY "customers_select_all" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert_all" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update_own" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Addresses
CREATE POLICY "addresses_select_all" ON public.addresses FOR SELECT TO authenticated USING (true);
CREATE POLICY "addresses_insert_all" ON public.addresses FOR INSERT TO authenticated WITH CHECK (true);

-- Products
CREATE POLICY "products_select_all" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert_own" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update_own" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "products_delete_own" ON public.products FOR DELETE TO authenticated USING (true);

-- Orders
CREATE POLICY "orders_select_all" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert_all" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders_update_all" ON public.orders FOR UPDATE TO authenticated USING (true);

-- Order Items
CREATE POLICY "order_items_select_all" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_items_insert_all" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- Deliveries
CREATE POLICY "deliveries_select_stable" ON public.deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "deliveries_insert_stable" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "deliveries_manage_stable" ON public.deliveries FOR UPDATE TO authenticated USING (true);

-- Reviews
CREATE POLICY "reviews_select_all" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT TO authenticated WITH CHECK (true);

-- Occurrences
CREATE POLICY "occurrences_select_all" ON public.occurrences FOR SELECT TO authenticated USING (true);
CREATE POLICY "occurrences_insert_own" ON public.occurrences FOR INSERT TO authenticated WITH CHECK (true);

-- Invitations
CREATE POLICY "invitations_select_all" ON public.invitations FOR SELECT TO authenticated USING (true);

-- =============================================
-- STORAGE BUCKET FOR AVATARS
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
