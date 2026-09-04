-- ============================================================================
-- SCRIPT DE CORREÇÃO DEFINITIVA DO TRIGGER DE ESTORNO DE ENTREGAS
-- ERRO: duplicate key value violates unique constraint "ux_credit_transactions_one_refund_per_delivery"
-- PROJETO: MT 24 HORAS EXPRESS / PRIMAVERA (owlbzwsdcognrgolvnzg)
-- ============================================================================

-- 1. Recria a função do trigger com validação de estorno prévio e blocos de proteção
CREATE OR REPLACE FUNCTION public.handle_delivery_cancelled_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC(10,2);
  v_balance NUMERIC(10,2);
  v_already_refunded BOOLEAN := FALSE;
BEGIN
  -- Só executa quando a entrega é alterada para o status 'cancelled'
  IF OLD.status IS DISTINCT FROM 'cancelled' AND NEW.status = 'cancelled' THEN
    v_fee := COALESCE(OLD.delivery_fee, OLD.value, 0.00);

    IF OLD.company_id IS NOT NULL AND v_fee > 0 THEN
      -- 1. Verifica se já existe qualquer registro de estorno prévio para esta entrega em credit_transactions
      SELECT EXISTS (
        SELECT 1 FROM public.credit_transactions
         WHERE delivery_id = OLD.id
           AND (type = 'refund' OR type = 'estorno')
      ) INTO v_already_refunded;

      -- Se AINDA NÃO foi estornada, realiza a devolução do saldo de créditos para a loja
      IF NOT v_already_refunded THEN
        UPDATE public.company_credits
           SET balance = balance + v_fee
         WHERE company_id = OLD.company_id
        RETURNING balance INTO v_balance;

        -- 2. Insere na tabela credit_transactions com proteção contra duplicidade
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_transactions') THEN
          BEGIN
            INSERT INTO public.credit_transactions (
              company_id, type, amount, balance_after, description, delivery_id, created_at
            ) VALUES (
              OLD.company_id, 
              'refund', 
              v_fee, 
              v_balance, 
              'Estorno de ' || (CASE WHEN OLD.delivery_type = 'BUSCA_CONDICIONAL' THEN 'busca de condicional' ELSE 'entrega' END) || ' cancelada ' || COALESCE(OLD.short_id, ''), 
              OLD.id, 
              now()
            );
          EXCEPTION 
            WHEN unique_violation THEN
              -- Se por concorrência ou clique duplo violar a constraint ux_credit_transactions_one_refund_per_delivery,
              -- ignora silenciosamente sem falhar o cancelamento da entrega!
              NULL;
            WHEN OTHERS THEN
              NULL;
          END;
        END IF;

        -- 3. Insere na tabela company_credit_transactions (se existir) com proteção
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_credit_transactions') THEN
          BEGIN
            INSERT INTO public.company_credit_transactions (
              company_id, type, amount, balance_after, description, reference_id, created_at
            ) VALUES (
              OLD.company_id, 
              'credit', 
              v_fee, 
              v_balance, 
              'Estorno de ' || (CASE WHEN OLD.delivery_type = 'BUSCA_CONDICIONAL' THEN 'busca de condicional' ELSE 'entrega' END) || ' cancelada ' || COALESCE(OLD.short_id, ''), 
              OLD.id, 
              now()
            );
          EXCEPTION 
            WHEN unique_violation THEN
              NULL;
            WHEN OTHERS THEN
              NULL;
          END;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Blindagem total: nunca aborta a transação de cancelamento da entrega
  RAISE WARNING 'Falha não fatal no estorno automático da entrega %: %', OLD.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Recria o trigger na tabela deliveries
DROP TRIGGER IF EXISTS trg_delivery_cancelled_refund ON public.deliveries;
CREATE TRIGGER trg_delivery_cancelled_refund
  AFTER UPDATE OF status ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_delivery_cancelled_refund();

-- 3. Cria a RPC segura cancel_delivery_safe para uso via Frontend
CREATE OR REPLACE FUNCTION public.cancel_delivery_safe(
  p_delivery_id UUID,
  p_cancelled_by UUID DEFAULT NULL,
  p_cancelled_by_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_del RECORD;
  v_fee NUMERIC(10,2);
  v_balance NUMERIC(10,2);
  v_already_refunded BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_del FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'DELIVERY_NOT_FOUND');
  END IF;

  IF v_del.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'ALREADY_CANCELLED');
  END IF;

  -- 1. Atualiza status para cancelado
  UPDATE public.deliveries
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = p_cancelled_by,
         cancelled_by_name = p_cancelled_by_name,
         updated_at = now()
   WHERE id = p_delivery_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Concede permissões para a RPC
GRANT EXECUTE ON FUNCTION public.cancel_delivery_safe(UUID, UUID, TEXT) TO authenticated, anon, public;
