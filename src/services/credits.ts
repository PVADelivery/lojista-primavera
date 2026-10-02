import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMyCompany } from "@/services/companies";

export const LOW_BALANCE_THRESHOLD = 50;

export interface CompanyCredits {
  id: string;
  company_id: string;
  balance: number;
  low_balance_threshold: number;
}

export interface CreditTransaction {
  id: string;
  company_id: string;
  type: "topup" | "debit" | "refund" | "adjustment";
  amount: number;
  balance_after: number;
  description: string | null;
  delivery_id: string | null;
  created_at: string;
}

export async function fetchCredits(companyId: string): Promise<CompanyCredits | null> {
  const { data, error } = await supabase
    .from("company_credits")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { id: "", company_id: companyId, balance: 0, low_balance_threshold: LOW_BALANCE_THRESHOLD };
  return { ...data, balance: Number(data.balance ?? 0), low_balance_threshold: Number(data.low_balance_threshold ?? LOW_BALANCE_THRESHOLD) };
}

export async function fetchCreditTransactions(companyId: string): Promise<CreditTransaction[]> {
  try {
    const [res1, res2] = await Promise.all([
      supabase
        .from("credit_transactions")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("company_credit_transactions")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const items1 = res1.data ?? [];
    const items2 = (res2.data ?? []).map((t: any) => ({
      id: t.id,
      company_id: t.company_id,
      type: t.type === "credit" || t.type === "refund" || t.type === "purchase"
        ? (t.type === "credit" ? (Number(t.amount) > 0 && t.description?.toLowerCase().includes("estorno") ? "refund" : "topup") : t.type)
        : t.type,
      amount: Number(t.amount ?? 0),
      balance_after: Number(t.balance_after ?? 0),
      description: t.description || null,
      delivery_id: t.reference_id || null,
      created_at: t.created_at,
    }));

    const map = new Map<string, CreditTransaction>();
    for (const item of items1) {
      map.set(item.id, {
        ...item,
        amount: Number(item.amount ?? 0),
        balance_after: Number(item.balance_after ?? 0),
      });
    }

    for (const item of items2) {
      const alreadyExists = Array.from(map.values()).some(
        (existing) =>
          existing.id === item.id ||
          (existing.delivery_id && item.delivery_id && existing.delivery_id === item.delivery_id && existing.type === item.type)
      );
      if (!alreadyExists) {
        map.set(item.id, item as CreditTransaction);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } catch (err) {
    console.error("[fetchCreditTransactions error]:", err);
    return [];
  }
}

/**
 * Realiza o estorno garantido do valor da taxa de uma entrega cancelada para o saldo do lojista
 * e registra no extrato de transações de créditos.
 */
export async function refundCancelledDelivery(deliveryId: string): Promise<boolean> {
  if (!deliveryId) return false;

  // 1. Tentar RPC dedicada do Supabase primeiro
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("cancel_delivery_and_refund", {
      p_delivery_id: deliveryId,
    });
    if (!rpcErr && (rpcRes as any)?.success) {
      console.log("[refundCancelledDelivery] Estorno processado via RPC cancel_delivery_and_refund:", rpcRes);
      return true;
    }
  } catch (_) {}

  // 2. Fallback resiliente: Obter dados da entrega
  try {
    const { data: delivery, error: delErr } = await supabase
      .from("deliveries")
      .select("id, company_id, delivery_fee, value, short_id, status, delivery_type")
      .eq("id", deliveryId)
      .maybeSingle();

    if (delErr || !delivery || !delivery.company_id) {
      console.warn("[refundCancelledDelivery] Entrega ou empresa não encontrada:", deliveryId, delErr);
      return false;
    }

    const fee = Number(delivery.delivery_fee || delivery.value || 0);
    if (fee <= 0) {
      console.log("[refundCancelledDelivery] Taxa zero ou inexistente, estorno não aplicável:", fee);
      return true;
    }

    // Verificar se já existe estorno para esta entrega
    const { data: existingRefund } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("delivery_id", deliveryId)
      .eq("type", "refund")
      .maybeSingle();

    if (existingRefund) {
      console.log("[refundCancelledDelivery] Entrega já estornada anteriormente:", deliveryId);
      return true;
    }

    // Tentar RPC add_company_credits
    try {
      const { data: addRes, error: addErr } = await supabase.rpc("add_company_credits", {
        _company_id: delivery.company_id,
        _amount: fee,
        _description: `Estorno de entrega cancelada ${delivery.short_id || ""}`.trim(),
        _payment_method: "Sistema",
        _type: "refund",
      });
      if (!addErr && (addRes as any)?.success) {
        return true;
      }
    } catch (_) {}

    // Fallback direto: Atualizar company_credits e inserir em credit_transactions
    const { data: existingCredit } = await supabase
      .from("company_credits")
      .select("balance")
      .eq("company_id", delivery.company_id)
      .maybeSingle();

    const curBal = Number(existingCredit?.balance || 0);
    const newBal = curBal + fee;

    await supabase.from("company_credits").upsert({
      company_id: delivery.company_id,
      balance: newBal,
      updated_at: new Date().toISOString(),
    });

    const desc = `Estorno de entrega cancelada ${delivery.short_id || ""}`.trim();

    try {
      await supabase.from("credit_transactions").insert({
        company_id: delivery.company_id,
        type: "refund",
        amount: fee,
        balance_after: newBal,
        description: desc,
        delivery_id: delivery.id,
      });
    } catch (e) {
      console.warn("[refundCancelledDelivery] Falha ao inserir credit_transactions:", e);
    }

    try {
      await supabase.from("company_credit_transactions").insert({
        company_id: delivery.company_id,
        type: "refund",
        amount: fee,
        balance_after: newBal,
        description: desc,
        reference_id: delivery.id,
        payment_method: "Sistema",
      });
    } catch (e) {
      console.warn("[refundCancelledDelivery] Falha ao inserir company_credit_transactions:", e);
    }

    return true;
  } catch (err) {
    console.error("[refundCancelledDelivery] Erro no fallback de estorno:", err);
    return false;
  }
}

export function useCredits() {
  const { data: company } = useMyCompany();
  const companyId = company?.id as string | undefined;
  const qc = useQueryClient();

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`credits-${companyId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "company_credits", filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["credits", companyId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_transactions", filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ["credits", companyId] });
        qc.invalidateQueries({ queryKey: ["credit-transactions", companyId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const query = useQuery({
    queryKey: ["credits", companyId],
    enabled: !!companyId,
    queryFn: () => fetchCredits(companyId as string),
  });

  const balance = Number(query.data?.balance ?? 0);
  const threshold = Number(query.data?.low_balance_threshold ?? LOW_BALANCE_THRESHOLD);

  return { ...query, companyId, balance, threshold, isLow: !!query.data && balance < threshold };
}

export function useCreditTransactions() {
  const { data: company } = useMyCompany();
  const companyId = company?.id as string | undefined;
  return useQuery({
    queryKey: ["credit-transactions", companyId],
    enabled: !!companyId,
    queryFn: () => fetchCreditTransactions(companyId as string),
  });
}

export function useCreditPurchaseRequests() {
  const { data: company } = useMyCompany();
  const companyId = company?.id as string | undefined;
  return useQuery({
    queryKey: ["credit-requests", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_purchase_requests")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRequestTopup() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, notes }: { amount: number; notes?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!company?.id) throw new Error("Empresa não encontrada");
      if (!auth?.user?.id) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("credit_purchase_requests").insert([
        { company_id: company.id, amount, notes: notes ?? null, status: "pending", requested_by: auth.user.id },
      ]);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-requests"] });
    },
  });
}
