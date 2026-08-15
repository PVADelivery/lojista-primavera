-- Migration: Suporte à Integração Oficial iFood MT 24 Horas
-- Data: 2026-08-15

-- 1. Colunas de vínculo externo em products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_category_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_external_id ON public.products(company_id, external_source, external_id);

-- 2. Colunas de vínculo externo em product_option_groups
ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE public.product_option_groups ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pog_external_id ON public.product_option_groups(product_id, external_source, external_id);

-- 3. Colunas de vínculo externo em product_options
ALTER TABLE public.product_options ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE public.product_options ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE INDEX IF NOT EXISTS idx_po_external_id ON public.product_options(group_id, external_source, external_id);

-- 4. Tabela de conexões com iFood
CREATE TABLE IF NOT EXISTS public.ifood_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  merchant_id TEXT NOT NULL,
  merchant_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected', -- 'connected', 'expired', 'disconnected'
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT
);

ALTER TABLE public.ifood_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ifood_connections_select_scoped ON public.ifood_connections;
CREATE POLICY ifood_connections_select_scoped ON public.ifood_connections
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ifood_connections_insert_scoped ON public.ifood_connections;
CREATE POLICY ifood_connections_insert_scoped ON public.ifood_connections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ifood_connections_update_scoped ON public.ifood_connections;
CREATE POLICY ifood_connections_update_scoped ON public.ifood_connections
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ifood_connections_delete_scoped ON public.ifood_connections;
CREATE POLICY ifood_connections_delete_scoped ON public.ifood_connections
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- 5. Tabela de logs de importação e sincronização iFood
CREATE TABLE IF NOT EXISTS public.ifood_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  merchant_id TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'import', 'sync'
  status TEXT NOT NULL, -- 'success', 'partial', 'failed'
  categories_count INT DEFAULT 0,
  products_found INT DEFAULT 0,
  products_created INT DEFAULT 0,
  products_updated INT DEFAULT 0,
  options_count INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ifood_import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ifood_import_logs_select_scoped ON public.ifood_import_logs;
CREATE POLICY ifood_import_logs_select_scoped ON public.ifood_import_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS ifood_import_logs_insert_scoped ON public.ifood_import_logs;
CREATE POLICY ifood_import_logs_insert_scoped ON public.ifood_import_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );
