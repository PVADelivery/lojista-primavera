
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'percentage',
  value NUMERIC NOT NULL,
  min_purchase NUMERIC,
  max_discount NUMERIC,
  expiration_date TIMESTAMPTZ,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  scope TEXT DEFAULT 'global',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_products (
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (coupon_id, product_id)
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_products ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_settings (
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  description TEXT,
  key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  value TEXT NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  error_code TEXT,
  error_message TEXT,
  event TEXT NOT NULL,
  http_status NUMERIC,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  payload JSONB,
  request_id UUID NOT NULL,
  source TEXT,
  user_id UUID
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.blocked_ips_log (
  email_tentativa TEXT,
  id SERIAL PRIMARY KEY NOT NULL,
  ip_address TEXT,
  tentado_em TEXT
);
ALTER TABLE public.blocked_ips_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  company_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  customer_id UUID,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  status TEXT,
  topic TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cities (
  active BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  name TEXT NOT NULL
);
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.coupon_companies (
  company_id UUID PRIMARY KEY NOT NULL,
  coupon_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.coupon_companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.delivery_occurrences (
  created_at TIMESTAMPTZ DEFAULT now(),
  delivery_id UUID PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  driver_id UUID NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  photo_url TEXT,
  resolved BOOLEAN,
  resolved_at TEXT,
  resolved_by TEXT,
  type TEXT
);
ALTER TABLE public.delivery_occurrences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.delivery_ratings (
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivery_id UUID PRIMARY KEY NOT NULL,
  driver_id UUID NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  rating NUMERIC NOT NULL
);
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.driver_earnings (
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivery_id UUID PRIMARY KEY,
  description TEXT,
  driver_id UUID NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  paid BOOLEAN,
  paid_at TEXT,
  type TEXT
);
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.driver_location_history (
  created_at TIMESTAMPTZ DEFAULT now(),
  delivery_id UUID PRIMARY KEY,
  driver_id UUID NOT NULL,
  heading NUMERIC,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  recorded_at TEXT,
  speed NUMERIC
);
ALTER TABLE public.driver_location_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
  app_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  email TEXT NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  ip_address TEXT
);
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notifications (
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  data JSONB,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  read BOOLEAN,
  title TEXT NOT NULL,
  type TEXT,
  user_id UUID NOT NULL
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.payments (
  created_at TIMESTAMPTZ DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  order_id UUID NOT NULL,
  paid_at TEXT,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  value JSONB NOT NULL
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_option_groups (
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  max_options NUMERIC NOT NULL,
  min_options NUMERIC NOT NULL,
  name TEXT NOT NULL,
  product_id UUID NOT NULL,
  required BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_options (
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  group_id UUID PRIMARY KEY NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  is_active BOOLEAN NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_logs (
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB
);
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_coupons (
  coupon_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  order_id UUID,
  used_at TEXT,
  user_id UUID
);
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.withdrawals (
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  notes TEXT,
  pix_key TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  status TEXT NOT NULL,
  user_id UUID NOT NULL
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;


