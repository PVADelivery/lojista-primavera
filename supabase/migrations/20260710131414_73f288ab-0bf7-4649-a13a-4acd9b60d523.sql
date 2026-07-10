
-- Enable RLS on tables that already have policies
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on remaining public tables without RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

-- Revoke EXECUTE from anon and authenticated on admin-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text, text, text, text, text, uuid, double precision, double precision, text, text, double precision) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_admin_user(jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_admin_user(text, text, text, text, text, text, text, text, uuid, double precision, double precision) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invitation(text, text, uuid, uuid, timestamp with time zone) FROM anon, authenticated, PUBLIC;
