-- 1. SALDO DE CRÉDITOS
CREATE TABLE public.company_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  low_balance_threshold numeric NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_credits TO authenticated;
GRANT ALL ON public.company_credits TO service_role;
ALTER TABLE public.company_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojista ve o proprio saldo"
ON public.company_credits FOR SELECT TO authenticated
USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_company_credits_updated_at
BEFORE UPDATE ON public.company_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. EXTRATO
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('topup','debit','refund','adjustment')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_company ON public.credit_transactions(company_id, created_at DESC);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojista ve o proprio extrato"
ON public.credit_transactions FOR SELECT TO authenticated
USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. PEDIDOS DE RECARGA
CREATE TABLE public.credit_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes text,
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.credit_purchase_requests TO authenticated;
GRANT UPDATE ON public.credit_purchase_requests TO authenticated;
GRANT ALL ON public.credit_purchase_requests TO service_role;
ALTER TABLE public.credit_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lojista ve os proprios pedidos de recarga"
ON public.credit_purchase_requests FOR SELECT TO authenticated
USING (public.user_owns_company(company_id) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Lojista cria pedido de recarga"
ON public.credit_purchase_requests FOR INSERT TO authenticated
WITH CHECK (public.user_owns_company(company_id) AND requested_by = auth.uid() AND status = 'pending');

CREATE POLICY "Admin atualiza pedidos de recarga"
ON public.credit_purchase_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_credit_purchase_requests_updated_at
BEFORE UPDATE ON public.credit_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. LINHA DE SALDO AUTOMÁTICA
CREATE OR REPLACE FUNCTION public.create_company_credit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.company_credits (company_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_credits_bootstrap
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.create_company_credit_row();

INSERT INTO public.company_credits (company_id, balance)
SELECT id, 0 FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- 5. ADMIN ADICIONA CRÉDITOS
CREATE OR REPLACE FUNCTION public.admin_add_credits(_company_id uuid, _amount numeric, _description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ADMIN');
  END IF;
  IF _amount IS NULL OR _amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  INSERT INTO public.company_credits (company_id, balance)
  VALUES (_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  UPDATE public.company_credits
     SET balance = balance + _amount
   WHERE company_id = _company_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_transactions (company_id, type, amount, balance_after, description, created_by)
  VALUES (_company_id, CASE WHEN _amount > 0 THEN 'topup' ELSE 'adjustment' END, _amount, v_balance,
          COALESCE(_description, 'Créditos adicionados pelo administrador'), auth.uid());

  IF _amount > 0 THEN
    BEGIN
      INSERT INTO public.platform_cash_flow (description, category, amount, type, date, origin)
      VALUES ('Venda de créditos', 'creditos', _amount, 'entrada', CURRENT_DATE, 'admin_add_credits');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_add_credits(uuid, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_add_credits(uuid, numeric, text) TO authenticated, service_role;

-- 6. CRIA ENTREGA DEBITANDO CRÉDITOS
CREATE OR REPLACE FUNCTION public.create_delivery_with_credits(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid := (p_payload->>'company_id')::uuid;
  v_fee numeric := COALESCE((p_payload->>'value')::numeric, 0);
  v_balance numeric;
  v_delivery_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  IF NOT (public.user_owns_company(v_company_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_FEE');
  END IF;

  INSERT INTO public.company_credits (company_id, balance)
  VALUES (v_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  SELECT balance INTO v_balance
    FROM public.company_credits
   WHERE company_id = v_company_id
   FOR UPDATE;

  IF v_balance < v_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS', 'balance', v_balance, 'required', v_fee);
  END IF;

  INSERT INTO public.deliveries (
    company_id, customer_id, short_id, customer_name, customer_phone, customer_cpf, address,
    customer_address_number, customer_neighborhood, customer_address_complement,
    payment_method, order_value, change_for, vehicle_type, region_id, value, notes, status
  ) VALUES (
    v_company_id,
    NULLIF(p_payload->>'customer_id', '')::uuid,
    p_payload->>'short_id',
    COALESCE(p_payload->>'customer_name', 'Cliente'),
    p_payload->>'customer_phone',
    NULLIF(p_payload->>'customer_cpf', ''),
    COALESCE(p_payload->>'address', 'Endereço não informado'),
    p_payload->>'customer_address_number',
    p_payload->>'customer_neighborhood',
    p_payload->>'customer_address_complement',
    p_payload->>'payment_method',
    COALESCE((p_payload->>'order_value')::numeric, 0),
    COALESCE((p_payload->>'change_for')::numeric, 0),
    p_payload->>'vehicle_type',
    NULLIF(p_payload->>'region_id', '')::uuid,
    v_fee,
    p_payload->>'notes',
    'pending'::public.delivery_status
  ) RETURNING id INTO v_delivery_id;

  UPDATE public.company_credits
     SET balance = balance - v_fee
   WHERE company_id = v_company_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_transactions (company_id, type, amount, balance_after, description, delivery_id, created_by)
  VALUES (v_company_id, 'debit', -v_fee, v_balance,
          'Entrega ' || COALESCE(p_payload->>'short_id', '') || ' - ' || COALESCE(p_payload->>'customer_name', ''),
          v_delivery_id, auth.uid());

  RETURN jsonb_build_object('success', true, 'delivery_id', v_delivery_id, 'balance', v_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_delivery_with_credits(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_delivery_with_credits(jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_company_credit_row() FROM anon, public;