
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','company','driver','customer');
CREATE TYPE public.profile_status AS ENUM ('pending','active','rejected');
CREATE TYPE public.order_status AS ENUM ('pending','preparing','ready','in_route','delivered','cancelled');
CREATE TYPE public.delivery_status AS ENUM ('pending','broadcasted','accepted','collecting','in_route','in_transit','completed','delivered','cancelled');
CREATE TYPE public.discount_type AS ENUM ('percentage','fixed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  document TEXT,
  status public.profile_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ REGIONS ============
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  category TEXT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  business_hours TEXT,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_companies_user ON public.companies(user_id);

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_company ON public.products(company_id);

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  cpf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_company ON public.customers(company_id);

-- ============ MOTOBOYS ============
CREATE TABLE public.motoboys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,2) DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.motoboys ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  delivery_id UUID,
  status public.order_status NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_address TEXT,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_company ON public.orders(company_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- ============ ORDER ITEMS ============
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============ DELIVERIES ============
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.motoboys(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  address TEXT NOT NULL,
  pickup_address TEXT,
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  notes TEXT,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_deliveries_company ON public.deliveries(company_id);
CREATE INDEX idx_deliveries_status ON public.deliveries(status);

-- ============ COUPONS ============
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type public.discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC(10,2) DEFAULT 0,
  max_discount_value NUMERIC(10,2),
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coupon_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  UNIQUE (coupon_id, product_id)
);
ALTER TABLE public.coupon_products ENABLE ROW LEVEL SECURITY;

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============ HELPER: company ownership ============
CREATE OR REPLACE FUNCTION public.user_owns_company(_company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND user_id = auth.uid())
$$;

-- ============ TRIGGER: auto-create profile ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (user_id) DO NOTHING;
  -- default role: company
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'company') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_deliveries_updated BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- user_roles
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- regions: public read, admin write
CREATE POLICY "regions read all" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "regions admin write" ON public.regions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- companies
CREATE POLICY "companies owner read" ON public.companies FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'customer') OR public.has_role(auth.uid(),'driver'));
CREATE POLICY "companies owner write" ON public.companies FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- products
CREATE POLICY "products read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products owner write" ON public.products FOR ALL TO authenticated USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin'));

-- customers
CREATE POLICY "customers owner all" ON public.customers FOR ALL TO authenticated USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin'));

-- motoboys
CREATE POLICY "motoboys read" ON public.motoboys FOR SELECT TO authenticated USING (true);
CREATE POLICY "motoboys self write" ON public.motoboys FOR ALL TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- orders
CREATE POLICY "orders owner all" ON public.orders FOR ALL TO authenticated USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin'));

-- order_items
CREATE POLICY "order_items via order" ON public.order_items FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.user_owns_company(o.company_id) OR public.has_role(auth.uid(),'admin')))) WITH CHECK (EXISTS(SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.user_owns_company(o.company_id) OR public.has_role(auth.uid(),'admin'))));

-- deliveries
CREATE POLICY "deliveries owner all" ON public.deliveries FOR ALL TO authenticated USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'driver')) WITH CHECK (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin'));

-- coupons
CREATE POLICY "coupons owner all" ON public.coupons FOR ALL TO authenticated USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.user_owns_company(company_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "coupon_products via coupon" ON public.coupon_products FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND (public.user_owns_company(c.company_id) OR public.has_role(auth.uid(),'admin')))) WITH CHECK (EXISTS(SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND (public.user_owns_company(c.company_id) OR public.has_role(auth.uid(),'admin'))));

-- invitations
CREATE POLICY "invitations admin all" ON public.invitations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoboys;
ALTER TABLE public.deliveries REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.motoboys REPLICA IDENTITY FULL;

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets','store-assets',true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars',true) ON CONFLICT DO NOTHING;

CREATE POLICY "store-assets read" ON storage.objects FOR SELECT USING (bucket_id = 'store-assets');
CREATE POLICY "store-assets upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'store-assets');
CREATE POLICY "store-assets update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'store-assets' AND owner = auth.uid());
CREATE POLICY "store-assets delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'store-assets' AND owner = auth.uid());

CREATE POLICY "avatars read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- seed a few regions
INSERT INTO public.regions (name, color, price, city) VALUES
  ('Centro','#3b82f6',8.00,'São Paulo'),
  ('Zona Norte','#10b981',12.00,'São Paulo'),
  ('Zona Sul','#f59e0b',15.00,'São Paulo'),
  ('Zona Leste','#ef4444',18.00,'São Paulo');
