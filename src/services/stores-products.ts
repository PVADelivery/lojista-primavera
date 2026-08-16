import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * CLIENTE (APP CONSUMIDOR)
 */
export function useStores(regionId?: string) {
  return useQuery({
    queryKey: ["stores", regionId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_companies");
      if (error) throw error;
      const rows = data ?? [];
      return regionId ? rows.filter((r: any) => r.city_id === regionId) : rows;
    },
  });
}

export function useStoreDetails(storeId: string) {
  return useQuery({
    queryKey: ["stores", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_companies");
      if (error) throw error;
      return (data ?? []).find((r: any) => r.id === storeId) ?? null;
    },
    enabled: !!storeId,
  });
}


export function useProducts(companyId: string) {
  return useQuery({
    queryKey: ["products", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

/**
 * LOJISTA (PAINEL DE GESTÃO)
 */
export function useProductsManager(companyId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["products-manager", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", companyId as string)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const createProduct = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("products").insert({ ...data, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products-manager"] }),
  });

  return { ...query, createProduct };
}
