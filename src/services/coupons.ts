import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Coupon {
  id: string;
  company_id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  active: boolean;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
  min_order_value: number;
  max_discount_value: number | null;
  created_at: string;
}

export interface CouponProduct {
  id: string;
  coupon_id: string;
  product_id: string;
}

export function useCoupons(companyId?: string) {
  return useQuery({
    queryKey: ["coupons", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Busca cupons vinculados em coupon_companies
      let linkedCouponIds = new Set<string>();
      try {
        const { data: links } = await supabase
          .from("coupon_companies")
          .select("coupon_id")
          .eq("company_id", companyId);

        if (links && links.length > 0) {
          links.forEach((l: any) => linkedCouponIds.add(l.coupon_id));
        }
      } catch {}

      // 2. Busca todos os cupons (sem filtro de coluna inexistente para evitar 400)
      const { data: allCoupons, error: allErr } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (allErr) {
        console.warn("[useCoupons] Erro ao carregar cupons:", allErr.message);
        return [];
      }

      if (!allCoupons || allCoupons.length === 0) return [];

      // 3. Filtra no cliente por company_id ou vínculo de coupon_companies ou cupons globais
      const filtered = allCoupons.filter((c: any) => {
        if (c.company_id && c.company_id === companyId) return true;
        if (linkedCouponIds.has(c.id)) return true;
        if (!c.company_id && linkedCouponIds.size === 0 && (c.scope === "global" || !c.scope)) return true;
        return false;
      });

      return filtered.map((d: any) => ({
        ...d,
        company_id: d.company_id || companyId,
        discount_type: d.discount_type || d.type || "percentage",
        discount_value: Number(d.discount_value ?? d.value ?? 0),
        min_order_value: Number(d.min_order_value ?? d.min_purchase ?? 0),
        max_discount_value: d.max_discount_value != null ? Number(d.max_discount_value) : (d.max_discount != null ? Number(d.max_discount) : null),
        expires_at: d.expires_at || d.expiration_date || null,
      })) as Coupon[];
    },
    enabled: !!companyId,
  });
}

export function useCouponProducts(couponId?: string) {
  return useQuery({
    queryKey: ["coupon-products", couponId],
    queryFn: async () => {
      if (!couponId) return [];
      const { data, error } = await supabase
        .from("coupon_products")
        .select("*")
        .eq("coupon_id", couponId);
      if (error) throw error;
      return data as CouponProduct[];
    },
    enabled: !!couponId,
  });
}

export function useCouponMutations(companyId?: string) {
  const qc = useQueryClient();

  const createCoupon = useMutation({
    mutationFn: async (payload: {
      code: string;
      description?: string | null;
      discount_type: "percentage" | "fixed";
      discount_value: number;
      usage_limit?: number | null;
      expires_at?: string | null;
      min_order_value?: number;
      max_discount_value?: number | null;
      product_ids?: string[];
    }) => {
      const { product_ids, ...couponData } = payload;
      const { data, error } = await supabase
        .from("coupons")
        .insert({ ...couponData, company_id: companyId, active: true } as any)
        .select()
        .single();
      if (error) throw error;

      if (product_ids?.length) {
        const rows = product_ids.map((pid) => ({
          coupon_id: (data as any).id,
          product_id: pid,
        }));
        await supabase.from("coupon_products").insert(rows as any);
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const updateCoupon = useMutation({
    mutationFn: async ({ id, data: updateData, product_ids }: { id: string; data: Partial<Coupon>, product_ids?: string[] }) => {
      const { error } = await supabase
        .from("coupons")
        .update(updateData as any)
        .eq("id", id);
      if (error) throw error;

      if (product_ids !== undefined) {
        await supabase.from("coupon_products").delete().eq("coupon_id", id);
        if (product_ids.length > 0) {
          const rows = product_ids.map((pid) => ({ coupon_id: id, product_id: pid }));
          await supabase.from("coupon_products").insert(rows as any);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coupons"] });
      qc.invalidateQueries({ queryKey: ["coupon-products"] });
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("coupons")
        .update({ active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });

  return { createCoupon, updateCoupon, deleteCoupon, toggleActive };
}

/** Validate a coupon code for a given company */
export async function validateCoupon(code: string, companyId: string) {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("active", true);

  if (error || !data || data.length === 0) {
    return { valid: false, message: "Cupom não encontrado." } as const;
  }

  const coupon = data[0] as any;
  if (coupon.company_id && coupon.company_id !== companyId) {
    // Check coupon_companies
    const { data: link } = await supabase
      .from("coupon_companies")
      .select("company_id")
      .eq("coupon_id", coupon.id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!link) {
      return { valid: false, message: "Cupom não aplicável a esta loja." } as const;
    }
  }

  const now = new Date();
  const expDate = coupon.expires_at || coupon.expiration_date;
  if (expDate && new Date(expDate) < now) {
    return { valid: false, message: "Cupom expirado." } as const;
  }
  if (coupon.usage_limit && (coupon.used_count || 0) >= coupon.usage_limit) {
    return { valid: false, message: "Cupom esgotado." } as const;
  }

  // Get linked products
  const { data: links } = await supabase
    .from("coupon_products")
    .select("product_id")
    .eq("coupon_id", coupon.id);
  
  const productIds = (links || []).map((l: any) => l.product_id);

  const formattedCoupon: Coupon = {
    ...coupon,
    company_id: coupon.company_id || companyId,
    discount_type: coupon.discount_type || coupon.type || "percentage",
    discount_value: Number(coupon.discount_value ?? coupon.value ?? 0),
    min_order_value: Number(coupon.min_order_value ?? coupon.min_purchase ?? 0),
    max_discount_value: coupon.max_discount_value != null ? Number(coupon.max_discount_value) : (coupon.max_discount != null ? Number(coupon.max_discount) : null),
    expires_at: expDate || null,
  };

  return { valid: true, coupon: formattedCoupon, productIds } as const;
}

/** Calculate discount for cart items */
export function calculateDiscount(
  coupon: Coupon,
  applicableProductIds: string[],
  cartItems: { id: string; price: number; quantity: number }[]
) {
  const isSpecific = applicableProductIds.length > 0;
  
  const eligibleItems = isSpecific
    ? cartItems.filter((i) => applicableProductIds.includes(i.id))
    : cartItems;

  const eligibleTotal = eligibleItems.reduce((s, i) => s + i.price * i.quantity, 0);

  if (eligibleTotal === 0) return 0;

  if (coupon.discount_type === "percentage") {
    const discount = (eligibleTotal * coupon.discount_value) / 100;
    if (coupon.max_discount_value) {
      return Math.min(discount, coupon.max_discount_value);
    }
    return Math.min(eligibleTotal, discount);
  }
  return Math.min(eligibleTotal, coupon.discount_value);
}
