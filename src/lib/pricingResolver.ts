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
  const { region, vehicleType, companySettings, pricingRules } = options;
  if (!region) return 10.00;

  const isCar = String(vehicleType || "").toLowerCase().includes("car");

  // Base fallback prices from official region record
  const motoDefault = Number(region.price ?? 0);
  const carDefault = Number((region.delivery_fee && Number(region.delivery_fee) > 0) 
    ? region.delivery_fee 
    : (motoDefault > 0 ? motoDefault * 1.5 : 25));

  const officialRegionPrice = isCar ? (carDefault > 0 ? carDefault : 25.00) : (motoDefault > 0 ? motoDefault : 10.00);

  // 1. Fixed Fee Mode for Store
  if (
    companySettings?.delivery_mode === "fixed_fee" &&
    companySettings?.delivery_fee != null &&
    Number(companySettings.delivery_fee) > 0
  ) {
    return Number(companySettings.delivery_fee);
  }

  // 2. Custom Pricing Table Rules (pricing_rules)
  if (Array.isArray(pricingRules) && pricingRules.length > 0) {
    const matchedRule = pricingRules.find(
      (rule) =>
        (rule.origin_region_id === region.id || rule.destination_region_id === region.id) &&
        rule.base_value != null &&
        rule.base_value !== "" &&
        Number(rule.base_value) > 0
    );

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

  // 3. Legacy Custom Pricing Matrix (delivery_regions_pricing)
  const legacyMatrix = companySettings?.delivery_regions_pricing;
  if (legacyMatrix) {
    let parsed = legacyMatrix;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch {}
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.matrix) {
      parsed = parsed.matrix;
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      const match = parsed.find((m: any) => (m.region_id === region.id || m.to === region.id) && Number(m.price) > 0);
      if (match && match.price != null && match.price !== "" && Number(match.price) > 0) {
        return Number(match.price);
      }
    }
  }

  // 4. Default Region Pricing (padrão da região)
  return officialRegionPrice;
}
