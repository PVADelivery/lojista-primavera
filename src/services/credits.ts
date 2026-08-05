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
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    amount: Number(t.amount ?? 0),
    balance_after: Number(t.balance_after ?? 0),
  }));
}

export function useCredits() {
  const { data: company } = useMyCompany();
  const companyId = company?.id as string | undefined;
  const qc = useQueryClient();

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`credits-${companyId}`)
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
