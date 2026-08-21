import { useMemo } from "react";
import { resolveRegionDeliveryFee, RegionPricingOptions } from "@/lib/pricingResolver";

/**
 * Custom hook to enforce 100% regional pricing consistency.
 */
export function usePricingConsistency(options: RegionPricingOptions): number {
  return useMemo(() => {
    return resolveRegionDeliveryFee(options);
  }, [
    options.region?.id,
    options.region?.price,
    options.region?.delivery_fee,
    options.vehicleType,
    options.companySettings?.delivery_mode,
    options.companySettings?.delivery_fee,
    options.companySettings?.delivery_regions_pricing,
    JSON.stringify(options.pricingRules || [])
  ]);
}
