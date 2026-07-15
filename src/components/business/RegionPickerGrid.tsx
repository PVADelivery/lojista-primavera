import React, { useEffect, useState, memo } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface RegionPickerGridProps {
  companyId?: string;
  onRegionSelect?: (fee: number, regionId: string, regionName: string) => void;
  disabled?: boolean;
  initialSelectedId?: string | null;
}

export const RegionPickerGrid = memo(({ companyId, onRegionSelect, disabled, initialSelectedId }: RegionPickerGridProps) => {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<any[]>([]);
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);

  useEffect(() => {
    const fetchRegions = async () => {
      setLoading(true);
      const { data } = await supabase.from('regions').select('*').order('name');
      const filtered = (data ?? []).filter(
        (r: any) => r.is_active !== false
      );
      setRegions(filtered);

      if (companyId) {
        const { data: comp } = await supabase
          .from('companies')
          .select('pricing_table_id, delivery_mode, delivery_fee, delivery_regions_pricing')
          .eq('id', companyId)
          .single();
        if (comp) {
          setCompanySettings(comp);
          if (comp.pricing_table_id) {
            const { data: rules } = await supabase
              .from('pricing_rules')
              .select('*')
              .eq('pricing_table_id', comp.pricing_table_id);
            if (rules) setPricingRules(rules);
          }
        }
      }

      setLoading(false);
    };
    fetchRegions();
  }, [companyId]);

  const getRegionFee = (region: any) => {
    if (companySettings?.delivery_mode === 'fixed_fee' && companySettings?.delivery_fee != null) {
      return Number(companySettings.delivery_fee);
    }

    // 1. Custom pricing matrix (custom_regions or regions)
    if (companySettings?.delivery_regions_pricing) {
      let matrix = companySettings.delivery_regions_pricing;
      if (typeof matrix === 'string') {
        try { matrix = JSON.parse(matrix); } catch(e) {}
      }
      if (matrix && typeof matrix === 'object' && !Array.isArray(matrix) && matrix.matrix) {
        matrix = matrix.matrix;
      }
      if (Array.isArray(matrix)) {
        const match = matrix.find((m: any) => m.region_id === region.id || m.to === region.id);
        if (match && match.price != null && match.price !== "") {
          return Number(match.price);
        }
      }
    }

    // 2. Custom pricing rule for this company's pricing table
    const rule = pricingRules.find(r => r.region_id === region.id);
    if (rule) return Number(rule.price);

    // 3. Fallback to region's default price
    return Number(region.price || 0);
  };

  const handleSelect = (region: any) => {
    if (disabled) return;
    const fee = getRegionFee(region);
    setSelectedId(region.id);
    onRegionSelect?.(fee, region.id, region.name);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (regions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma região cadastrada no sistema.
      </p>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {regions.map((region) => {
        const fee = getRegionFee(region);
        const hasFee = fee != null && !isNaN(fee);
        const isSelected = selectedId === region.id;
        const color = region.color || '#3b82f6';

        return (
          <button
            key={region.id}
            type="button"
            onClick={() => handleSelect(region)}
            disabled={disabled || !hasFee}
            className={`relative flex flex-col items-start gap-1.5 p-4 rounded-2xl border-2 transition-all text-left ${
              isSelected
                ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
            } ${!hasFee ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {isSelected && (
              <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-primary" />
            )}
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs sm:text-sm font-bold text-foreground leading-tight break-words w-full">
              {region.name}
            </span>
            {hasFee ? (
              <span
                className={`text-sm font-black ${
                  isSelected ? "text-primary" : "text-foreground"
                }`}
              >
                R$ {fee.toFixed(2).replace('.', ',')}
              </span>
            ) : (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Sem valor
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

RegionPickerGrid.displayName = "RegionPickerGrid";
