import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

export async function fetchCompanies() {
  const response = await supabase.from("companies").select("*").order("name");
  console.log("FETCH COMPANIES RESPONSE:", response);
  if (response.error) throw response.error;
  return response.data ?? [];
}

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });
}


export async function fetchCompanyByUserId(userId: string) {
  // 1. Tenta buscar empresa vinculada diretamente ao user_id
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId);
  
  if (error) {
    console.error("[COMPANIES] Erro ao buscar empresa por user_id:", error);
  }
  
  if (data && data.length > 0) {
    return data[0];
  }

  // 2. Se houver uma empresa salva no localStorage (para administradores ou troca de loja)
  if (typeof window !== "undefined") {
    const savedCompanyId = localStorage.getItem("pva_selected_company_id");
    if (savedCompanyId) {
      const { data: savedCo } = await supabase
        .from("companies")
        .select("*")
        .eq("id", savedCompanyId)
        .maybeSingle();
      if (savedCo) return savedCo;
    }
  }

  // 3. Fallback inteligente: buscar empresa que tenha produtos cadastrados (ex: Açaí Primavera / Cremosinho)
  const { data: prods } = await supabase
    .from("products")
    .select("company_id")
    .limit(1);

  if (prods && prods.length > 0 && prods[0].company_id) {
    const { data: companyWithProds } = await supabase
      .from("companies")
      .select("*")
      .eq("id", prods[0].company_id)
      .maybeSingle();
    if (companyWithProds) return companyWithProds;
  }

  // 4. Último fallback: primeira empresa ativa cadastrada
  const { data: fallbackCompanies } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);

  if (fallbackCompanies && fallbackCompanies.length > 0) {
    return fallbackCompanies[0];
  }

  return null;
}

export function useCompany(userId?: string) {
  return useQuery({
    queryKey: ["company", userId],
    queryFn: () => (userId ? fetchCompanyByUserId(userId) : null),
    enabled: !!userId,
  });
}

export function useMyCompany() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-company', user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchCompanyByUserId(user!.id),
  });
}

