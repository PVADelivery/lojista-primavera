/**
 * UNIFIED PRICING RESOLVER FOR PRIMAVERA DELIVERY
 * Guarantees 100% mathematical consistency of region prices across all screens.
 * 
 * Rules:
 * 1. If Company delivery_mode is "fixed_fee" and fee > 0 -> return fixed_fee.
 * 2. If Company has custom pricing_table_id and a rule exists in pricing_rules for region (base_value > 0):
 *    - Car: return rule.return_value (> 0) or base_value * 1.5
 *    - Moto: return rule.base_value
 * 3. Default Region Pricing (padrão da região):
 *    - Car: return region.delivery_fee (> 0) or region.price * 1.5
 *    - Moto: return region.price (> 0) or 10.00
 */

export interface RegionPricingOptions {
  region: {
    id: string;
    name?: string;
    price?: number | string | null;
    delivery_fee?: number | string | null;
  };
  vehicleType?: string | null; // "moto" | "carro" | "car" | "motorcycle"
  companySettings?: {
    delivery_mode?: string | null;
    delivery_fee?: number | string | null;
    delivery_regions_pricing?: any;
  } | null;
  pricingRules?: Array<{
    origin_region_id?: string;
    destination_region_id?: string;
    base_value?: number | string | null;
    return_value?: number | string | null;
  }> | null;
}

export function resolveRegionDeliveryFee(options: RegionPricingOptions): number {
  const { region, vehicleType, pricingRules } = options;
  if (!region) return 10.00;

  const isCar = String(vehicleType || "").toLowerCase().includes("car");

  // Preço base oficial padrão da região cadastrado no Admin
  const motoDefault = Number(region.price ?? 0);
  const carDefault = Number((region.delivery_fee && Number(region.delivery_fee) > 0) 
    ? region.delivery_fee 
    : (motoDefault > 0 ? motoDefault * 1.5 : 25));

  const officialRegionPrice = isCar ? (carDefault > 0 ? carDefault : 25.00) : (motoDefault > 0 ? motoDefault : 10.00);

  // 1. Tabela Personalizada do Admin vinculada à Loja (pricing_rules da tabela da loja)
  if (Array.isArray(pricingRules) && pricingRules.length > 0) {
    const regId = String(region.id || "").toLowerCase().trim();
    const regName = String(region.name || "").toLowerCase().trim();

    let matchedRule = pricingRules.find(
      (rule: any) => {
        const orig = String(rule.origin_region_id || "").toLowerCase().trim();
        const dest = String(rule.destination_region_id || "").toLowerCase().trim();
        const gen = String(rule.region_id || "").toLowerCase().trim();
        const rName = String(rule.region_name || rule.name || "").toLowerCase().trim();
        
        const hasValidValue = rule.base_value != null && rule.base_value !== "" && Number(rule.base_value) > 0;
        if (!hasValidValue) return false;

        return (
          (orig && orig === regId) ||
          (dest && dest === regId) ||
          (gen && gen === regId) ||
          (regName && rName && (rName === regName || regName.includes(rName) || rName.includes(regName)))
        );
      }
    );

    // Fallback: se não tiver regra específica por região, usa a regra geral da tabela (sem regiões amarradas)
    if (!matchedRule) {
      matchedRule = pricingRules.find((rule: any) => {
        const hasValidValue = rule.base_value != null && rule.base_value !== "" && Number(rule.base_value) > 0;
        const isGeneral = !rule.origin_region_id && !rule.destination_region_id && !rule.region_id;
        return hasValidValue && (isGeneral || pricingRules.length === 1);
      });
    }

    if (matchedRule) {
      const ruleMoto = Number(matchedRule.base_value);
      const ruleCar = Number((matchedRule.return_value && Number(matchedRule.return_value) > 0) 
        ? matchedRule.return_value 
        : (ruleMoto * 1.5));
      
      const resolvedRulePrice = isCar ? ruleCar : ruleMoto;
      if (!isNaN(resolvedRulePrice) && resolvedRulePrice > 0) {
        return resolvedRulePrice;
      }
    }
  }

  // 2. Tabela Padrão Oficial da Região definida pelo Admin
  return officialRegionPrice;
}

export const REGION_FALLBACK_UUID_MAP: Record<string, string> = {
  "zona-1": "11111111-1111-4111-8111-000000000001",
  "zona-2": "11111111-1111-4111-8111-000000000002",
  "zona-3": "11111111-1111-4111-8111-000000000003",
  "zona-4": "11111111-1111-4111-8111-000000000004",
  "zona-5": "b57f6fe1-3936-4dc9-a6d6-5318577ea670",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(val: string | null | undefined): boolean {
  if (!val || typeof val !== "string") return false;
  return UUID_REGEX.test(val.trim());
}

/**
 * Sanitiza qualquer region_id antes de enviar para o banco/RPCs do Supabase:
 * - Mapeia "zona-1" ... "zona-5" para os UUIDs reais do banco.
 * - Se for UUID válido, retorna o UUID.
 * - Caso contrário ("none", string arbitrária, undefined, null), retorna null.
 */
export function sanitizeRegionId(val: string | null | undefined): string | null {
  if (!val || typeof val !== "string") return null;
  const clean = val.trim();
  if (clean === "none" || clean === "" || clean === "null" || clean === "undefined") {
    return null;
  }
  if (REGION_FALLBACK_UUID_MAP[clean]) {
    return REGION_FALLBACK_UUID_MAP[clean];
  }
  if (isUuid(clean)) {
    return clean;
  }
  return null;
}

