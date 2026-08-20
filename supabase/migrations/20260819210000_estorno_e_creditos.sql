-- ============================================================================
-- SCRIPT DE ESTORNO AUTOMÁTICO DE ENTREGAS CANCELADAS E DÉBITO EM LOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_delivery_cancelled_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC(10,2);
  v_balance NUMERIC(10,2);
BEGIN
  IF OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN
    v_fee := COALESCE(OLD.delivery_fee, OLD.value, 0.00);

    IF OLD.company_id IS NOT NULL AND v_fee > 0 THEN
      UPDATE public.company_credits
         SET balance = balance + v_fee
       WHERE company_id = OLD.company_id
      RETURNING balance INTO v_balance;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_transactions') THEN
        INSERT INTO public.credit_transactions (company_id, type, amount, balance_after, description, delivery_id, created_at)
        VALUES (OLD.company_id, 'refund', v_fee, v_balance, 'Estorno de entrega cancelada ' || COALESCE(OLD.short_id, ''), OLD.id, now());
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_credit_transactions') THEN
        INSERT INTO public.company_credit_transactions (company_id, type, amount, balance_after, description, reference_id, created_at)
        VALUES (OLD.company_id, 'credit', v_fee, v_balance, 'Estorno de entrega cancelada ' || COALESCE(OLD.short_id, ''), OLD.id, now());
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_cancelled_refund ON public.deliveries;
CREATE TRIGGER trg_delivery_cancelled_refund
  AFTER UPDATE OF status ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_delivery_cancelled_refund();
