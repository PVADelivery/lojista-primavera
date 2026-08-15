import { memo, useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Building2, ChevronDown, Loader2, Search, MapPin, X } from "lucide-react";
import { useMyCompany } from "@/services/companies";

export interface DeliveryZone {
  id: string;
  title: string;
  number: string;
  price: number;
  neighborhoods: string[];
  note?: string;
  color?: string;
}

// Fallback initial zones in case database is offline
const FALLBACK_ZONES: DeliveryZone[] = [
  {
    id: "zona-1",
    title: "Região 1",
    number: "1",
    price: 8,
    neighborhoods: [],
    color: "#eab308",
  },
  {
    id: "zona-2",
    title: "CENTRO - PVA 1 / JD RIVA 1/2/3/4",
    number: "2",
    price: 10,
    neighborhoods: [
      "ATLATICO SUL", "BELA VISTA", "BELVEDELE", "CASTELADIA 1/2/3/4", "CENTRO LESTE",
      "COAB JAIME CAMPOS", "COAB TRANCREDO NEVES", "COND. CIDADE JARDIM", "COND. PADOVA",
      "COND. ROMANA", "COND. VENETO", "CRISTO REI - FELIZ NATAL",
      "DISTRITO INDUSTRIAL ATÉ POSTO ALDO / SHELL", "GNOATO", "JD DAS AMERICA 1/2/3",
      "JD ITALIA", "JD MARINGA", "JD MILANO", "JD PROGRESSO", "JD SERRA DAS FLORES",
      "JD UNIVERSITARIO - PARMA 1", "JD VENEZA", "JD VITORIA", "JD VOLTA GRANDE",
      "NOVO HORIZONTE", "PARQUE DA ÁGUAS", "PARQUE ELDORADO", "PIONEIRO",
      "PONCHO VERDE 1/2", "PVA 2", "PVA 4", "SANTA CLARA", "SÃO CRISTOVÃO 1/2/3",
      "SÃO JOSE", "VERTERTES DAS ÁGUAS", "VILA POPULAR",
    ],
    color: "#eab308",
  },
  {
    id: "zona-3",
    title: "REGIÃO 3",
    number: "3",
    price: 12,
    neighborhoods: [
      "BURITIS 1/2/3/4/5", "CHACARA FONTANA", "COND. PORTO SEGURO",
      "COND. SPLERODE (ENTRADA EUROPA)", "COND. TERRAZ",
      "DISTRITO INDUSTRIAL ATRAS SHELL (ALVORADA)", "GÜTERRES",
      "INDUSTRIAL JOSE DE ALENCAR", "JD 3 AMERICAS 1/2", "JD FLORENÇA - VILA GRAMADO",
      "JD LUCIANA 1/2", "JD NOVA ESPERANÇA", "PONCHO VERDE 3/4/5",
      "PVA 3 - PADRE ONESTO COSTA", "TUIUIU",
    ],
    color: "#eab308",
  },
  {
    id: "zona-4",
    title: "REGIÃO 4",
    number: "4",
    price: 15,
    neighborhoods: [
      "ATÉ ROYAL - POLICIA PRF - CARGIL", "BURITIS PRIME - BURITIS 6",
      "BURITIS UNIVERSITARIO 1/2 - FASIPE", "JD DOS IPES (CASAS PACAEMBU)",
      "JD EUROPA", "MT 130 - FENDT - IGUAÇU MAQUINAS", "SAIDA PRA BARRA - NA KAOPPA",
      "SANTA FELICIDADE",
    ],
    color: "#eab308",
  },
  {
    id: "zona-5",
    title: "Região 5",
    number: "5",
    price: 20,
    neighborhoods: [],
    color: "#eab308",
  },
];

interface Props {
  onRegionSelect?: (fee: number, regionId: string, regionName: string) => void;
  disabled?: boolean;
  companyId?: string;
  initialSelectedId?: string;
}

export const RegionZoneSelector = memo(({ onRegionSelect, disabled, companyId, initialSelectedId }: Props) => {
  const { data: myCompany } = useMyCompany();
  const [loading, setLoading] = useState(true);
  const [dbRegions, setDbRegions] = useState<any[]>([]);
  const [dbHoods, setDbHoods] = useState<any[]>([]);
  const [selected, setSelected] = useState<{ zoneId: string; name: string } | null>(null);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const activeCompany = companyId ? { id: companyId } : myCompany;

  // Fecha dropdown de busca ao clicar fora
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // Carregar Regiões e Bairros dinamicamente do Banco de Dados
  const loadData = async () => {
    try {
      const [regionsRes, hoodsRes] = await Promise.all([
        supabase.from("regions").select("*"),
        supabase.from("region_neighborhoods").select("*"),
      ]);

      if (regionsRes.error) {
        console.error("[RegionZoneSelector] Erro ao buscar regions do banco:", regionsRes.error);
      }

      if (regionsRes.data && regionsRes.data.length > 0) {
        const filtered = regionsRes.data.filter((r: any) => r.is_active !== false);
        // Ordena em memória por sort_order, price ou nome
        filtered.sort((a: any, b: any) => {
          const ordA = a.sort_order != null ? Number(a.sort_order) : (Number(a.price ?? a.delivery_fee ?? 0));
          const ordB = b.sort_order != null ? Number(b.sort_order) : (Number(b.price ?? b.delivery_fee ?? 0));
          return ordA - ordB;
        });
        setDbRegions(filtered);
      }

      if (hoodsRes.data && hoodsRes.data.length > 0) {
        const sortedHoods = [...hoodsRes.data].sort((a: any, b: any) => {
          return (a.name || "").localeCompare(b.name || "", "pt-BR");
        });
        setDbHoods(sortedHoods);
      }
    } catch (err) {
      console.warn("[RegionZoneSelector] Erro ao carregar regiões:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Inscrição Realtime para atualizar instantaneamente quando o Admin alterar nomes/preços/bairros
    const channel = supabase
      .channel("realtime-regions-selector")
      .on("postgres_changes", { event: "*", schema: "public", table: "regions" }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "region_neighborhoods" }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Mapeia regiões e calcula os valores (considerando tabela personalizada da empresa se houver)
  const resolvedZones: DeliveryZone[] = useMemo(() => {
    if (dbRegions.length === 0) {
      return FALLBACK_ZONES;
    }

    const companyPricingMatrix = (activeCompany as any)?.delivery_regions_pricing;
    let customMatrix: any[] = [];
    if (companyPricingMatrix) {
      let parsed = companyPricingMatrix;
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.matrix) {
        parsed = parsed.matrix;
      }
      if (Array.isArray(parsed)) {
        customMatrix = parsed;
      }
    }

    return dbRegions.map((r, index) => {
      let finalPrice = Number(r.price ?? r.delivery_fee ?? 0);

      // Checa se há taxa fixa da loja
      if ((activeCompany as any)?.delivery_mode === "fixed_fee" && (activeCompany as any)?.delivery_fee != null) {
        finalPrice = Number((activeCompany as any).delivery_fee);
      } else if (customMatrix.length > 0) {
        const match = customMatrix.find((m: any) => m.region_id === r.id || m.to === r.id);
        if (match && match.price != null && match.price !== "") {
          finalPrice = Number(match.price);
        }
      }

      // Bairros vinculados à região no Admin
      const hoods = dbHoods
        .filter((h) => h.region_id === r.id)
        .map((h) => h.name);

      return {
        id: r.id,
        title: r.name,
        number: String(r.sort_order ?? index + 1),
        price: finalPrice,
        neighborhoods: hoods,
        color: r.color || "#eab308",
      };
    });
  }, [dbRegions, dbHoods, activeCompany]);

  // Lista agregada de todos os bairros para a busca rápida
  const allSearchableNeighborhoods = useMemo(() => {
    const list: Array<{ name: string; zone: DeliveryZone }> = [];
    resolvedZones.forEach((z) => {
      z.neighborhoods.forEach((hood) => {
        list.push({ name: hood, zone: z });
      });
    });
    return list;
  }, [resolvedZones]);

  // Bairros filtrados pela busca
  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return allSearchableNeighborhoods
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [searchTerm, allSearchableNeighborhoods]);

  const pick = (zone: DeliveryZone, name: string) => {
    if (disabled) return;
    setSelected({ zoneId: zone.id, name });
    onRegionSelect?.(zone.price, zone.id, name);
  };

  const handleSelectFromSearch = (item: { name: string; zone: DeliveryZone }) => {
    setSearchTerm(item.name);
    setIsSearchFocused(false);
    // Expande a zona automaticamente para visualização
    setExpandedZones((prev) => new Set([...prev, item.zone.id]));
    pick(item.zone, item.name);
  };

  const toggleZone = (zoneId: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      return next;
    });
  };

  if (loading && dbRegions.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-xs font-semibold">Carregando regiões e bairros definidos pelo Admin...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* ── CAMPO DE BUSCA DE BAIRRO (AUTO-SELEÇÃO DE VALOR) ── */}
      <div ref={searchWrapRef} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearchFocused(true);
            }}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="🔍 Digite o nome do bairro para definir o valor automaticamente..."
            className="w-full h-12 pl-10 pr-10 rounded-2xl border-2 border-border bg-card text-foreground font-semibold text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setIsSearchFocused(false);
              }}
              className="absolute right-3.5 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown de Resultados da Busca de Bairros */}
        {isSearchFocused && searchTerm.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-14 z-50 rounded-2xl border-2 border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {searchResults.length > 0 ? (
              <div className="max-h-64 overflow-y-auto divide-y divide-border">
                {searchResults.map((item, idx) => (
                  <button
                    key={`${item.name}-${idx}`}
                    type="button"
                    onClick={() => handleSelectFromSearch(item)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="h-4 w-4 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="text-sm font-black text-foreground truncate">{item.name}</div>
                        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: item.zone.color || "#eab308" }}
                          />
                          {item.zone.title} (Região {item.zone.number})
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black text-black shadow-sm"
                        style={{ backgroundColor: item.zone.color || "#eab308" }}
                      >
                        R$ {item.zone.price.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-xs font-semibold text-muted-foreground">
                Nenhum bairro cadastrado com o termo "{searchTerm}".
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs font-black text-muted-foreground uppercase tracking-wider px-1">
        Ou selecione diretamente a região abaixo:
      </div>

      {resolvedZones.map((zone, idx) => {
        const isZoneSelected = selected?.zoneId === zone.id;
        const isExpanded = expandedZones.has(zone.id);
        const hasNeighborhoods = zone.neighborhoods.length > 0;
        const displayIndex = zone.number || String(idx + 1);
        const zoneColor = zone.color || "#eab308";

        return (
          <div
            key={zone.id}
            className="rounded-3xl border-2 overflow-hidden transition-all shadow-sm"
            style={{
              borderColor: isZoneSelected ? zoneColor : undefined,
              boxShadow: isZoneSelected ? `0 0 0 2px ${zoneColor}33` : undefined,
            }}
          >
            {/* Header da Região */}
            <div className="flex flex-wrap items-center gap-3 bg-foreground text-background px-4 py-3">
              <div
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: zoneColor }}
              />
              <span className="text-xs sm:text-sm font-black uppercase tracking-wide flex-1 min-w-0">
                {zone.title}
              </span>
              <span className="text-lg font-black" style={{ color: zoneColor }}>
                {displayIndex} <span className="text-xs font-bold text-background/80">(R$ {zone.price.toFixed(2).replace(".", ",")})</span>
              </span>
            </div>

            <div
              className="p-4 space-y-3 transition-colors"
              style={{ backgroundColor: zoneColor }}
            >
              {hasNeighborhoods && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-black/80 uppercase tracking-wide">
                    {zone.neighborhoods.length} bairro{zone.neighborhoods.length > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleZone(zone.id)}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-black hover:opacity-80 transition-opacity"
                  >
                    {isExpanded ? "Ocultar bairros" : "Ver bairros"}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              )}

              {/* Lista de Bairros (Bolinhas/Botões) */}
              {isExpanded && hasNeighborhoods && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {(() => {
                    const sorted = [...zone.neighborhoods].sort((a, b) =>
                      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
                    );
                    const mid = Math.ceil(sorted.length / 2);
                    const left = sorted.slice(0, mid);
                    const right = sorted.slice(mid);
                    const max = Math.max(left.length, right.length);
                    return Array.from({ length: max }, (_, i) => (
                      <div key={i} className="contents">
                        {left[i] ? (
                          <button
                            key={left[i]}
                            type="button"
                            onClick={() => pick(zone, left[i])}
                            className={`relative text-left text-[11px] sm:text-xs font-bold rounded-xl border px-3 py-2 transition-all ${
                              isZoneSelected && selected?.name === left[i]
                                ? "border-black bg-black text-white shadow-md font-black"
                                : "border-black/20 bg-white/90 hover:bg-white text-black"
                            }`}
                          >
                            {isZoneSelected && selected?.name === left[i] && (
                              <CheckCircle2 className="absolute right-2 top-2 h-3.5 w-3.5 text-white" />
                            )}
                            {left[i]}
                          </button>
                        ) : (
                          <span />
                        )}
                        {right[i] ? (
                          <button
                            key={right[i]}
                            type="button"
                            onClick={() => pick(zone, right[i])}
                            className={`relative text-left text-[11px] sm:text-xs font-bold rounded-xl border px-3 py-2 transition-all ${
                              isZoneSelected && selected?.name === right[i]
                                ? "border-black bg-black text-white shadow-md font-black"
                                : "border-black/20 bg-white/90 hover:bg-white text-black"
                            }`}
                          >
                            {isZoneSelected && selected?.name === right[i] && (
                              <CheckCircle2 className="absolute right-2 top-2 h-3.5 w-3.5 text-white" />
                            )}
                            {right[i]}
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* Botão de Ação Principal da Região */}
              <button
                type="button"
                onClick={() => pick(zone, zone.title)}
                className={`w-full h-12 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 ${
                  isZoneSelected && selected?.name === zone.title
                    ? "bg-black text-white ring-2 ring-black/40 scale-[1.01]"
                    : "bg-black/90 text-white hover:bg-black"
                }`}
              >
                {zone.title} · R$ {zone.price.toFixed(2).replace(".", ",")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
});

RegionZoneSelector.displayName = "RegionZoneSelector";
