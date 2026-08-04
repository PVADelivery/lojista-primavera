import { memo, useState } from "react";
import { CheckCircle2, Building2, ChevronDown } from "lucide-react";

export interface DeliveryZone {
  id: string;
  title: string;
  number: string;
  price: number;
  neighborhoods: string[];
  note?: string;
}

export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "zona-1",
    title: "Região 1",
    number: "1",
    price: 8,
    neighborhoods: [],
  },
  {
    id: "zona-2",
    title: "CENTRO - PVA 1 / JD RIVA 1/2/3/4",
    number: "2",
    price: 10,
    neighborhoods: [
      "CENTRO LESTE",
      "JD MARINGA",
      "PVA 2",
      "PVA 4",
      "BELVEDELE",
      "ATLATICO SUL",
      "BELA VISTA",
      "COND. CIDADE JARDIM",
      "DISTRITO INDUSTRIAL ATÉ POSTO ALDO / SHELL",
      "COND. VENETO",
      "COND. ROMANA",
      "COND. PADOVA",
      "JD DAS AMERICA 1/2/3",
      "JD ITALIA",
      "JD VENEZA",
      "JD VITORIA",
      "VERTERTES DAS ÁGUAS",
      "PONCHO VERDE 1/2",
      "JD UNIVERSITARIO - PARMA 1",
      "PARQUE ELDORADO",
      "NOVO HORIZONTE",
      "PARQUE DA ÁGUAS",
      "JD VOLTA GRANDE",
      "COAB JAIME CAMPOS",
      "GNOATO",
      "COAB TRANCREDO NEVES",
      "VILA POPULAR",
      "PIONEIRO",
      "JD PROGRESSO",
      "JD SERRA DAS FLORES",
      "CRISTO REI - FELIZ NATAL",
      "CASTELADIA 1/2/3/4",
      "SANTA CLARA",
      "JD MILANO",
      "SÃO JOSE",
      "SÃO CRISTOVÃO 1/2/3",
    ],
  },
  {
    id: "zona-3",
    title: "REGIÃO 3",
    number: "3",
    price: 12,
    neighborhoods: [
      "COND. PORTO SEGURO",
      "COND. TERRAZ",
      "COND. SPLERODE (ENTRADA EUROPA)",
      "PONCHO VERDE 3/4/5",
      "JD LUCIANA 1/2",
      "CHACARA FONTANA",
      "INDUSTRIAL JOSE DE ALENCAR",
      "BURITIS 1/2/3/4/5",
      "PVA 3 - PADRE ONESTO COSTA",
      "JD FLORENÇA - VILA GRAMADO",
      "JD 3 AMERICAS 1/2",
      "JD NOVA ESPERANÇA",
      "DISTRITO INDUSTRIAL ATRAS SHELL (ALVORADA)",
      "TUIUIU",
      "GÜTERRES",
    ],
  },
  {
    id: "zona-4",
    title: "REGIÃO 4",
    number: "4",
    price: 15,
    neighborhoods: [
      "BURITIS UNIVERSITARIO 1/2 - FASIPE",
      "BURITIS PRIME - BURITIS 6",
      "MT 130 - FENDT - IGUAÇU MAQUINAS",
      "SAIDA PRA BARRA - NA KAOPPA",
      "ATÉ ROYAL - POLICIA PRF - CARGIL",
      "JD DOS IPES (CASAS PACAEMBU)",
      "JD EUROPA",
      "SANTA FELICIDADE",
    ],
  },
  {
    id: "zona-5",
    title: "Região 5",
    number: "5",
    price: 20,
    neighborhoods: [],
  },
];

interface Props {
  onRegionSelect?: (fee: number, regionId: string, regionName: string) => void;
  disabled?: boolean;
}

export const RegionZoneSelector = memo(({ onRegionSelect, disabled }: Props) => {
  const [selected, setSelected] = useState<{ zone: string; name: string } | null>(null);
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  const pick = (zone: DeliveryZone, name: string) => {
    if (disabled) return;
    setSelected({ zone: zone.id, name });
    onRegionSelect?.(zone.price, "none", name);
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

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {DELIVERY_ZONES.map((zone) => {
        const isZoneSelected = selected?.zone === zone.id;
        const isExpanded = expandedZones.has(zone.id);
        const hasNeighborhoods = zone.neighborhoods.length > 0;
        return (
          <div
            key={zone.id}
            className={`rounded-3xl border-2 overflow-hidden transition-all ${
              isZoneSelected ? "border-primary shadow-md" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3 bg-foreground text-background px-4 py-3">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs sm:text-sm font-black uppercase tracking-wide flex-1 min-w-0">
                {zone.title}
              </span>
              <span className="text-lg font-black text-primary">
                {zone.number} <span className="text-xs">(R$ {zone.price.toFixed(2).replace(".", ",")})</span>
              </span>
            </div>

            <div className="p-4 bg-card space-y-3">
              {hasNeighborhoods && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    {zone.neighborhoods.length} bairro{zone.neighborhoods.length > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleZone(zone.id)}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-primary hover:text-primary/80 transition-colors"
                  >
                    {isExpanded ? "Ocultar bairros" : "Ver bairros"}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              )}

              {isExpanded && hasNeighborhoods && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {zone.neighborhoods.map((n) => {
                    const active = isZoneSelected && selected?.name === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => pick(zone, n)}
                        className={`relative text-left text-[11px] sm:text-xs font-bold rounded-xl border px-3 py-2 transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:border-primary/40 hover:bg-muted/50 text-foreground"
                        }`}
                      >
                        {active && <CheckCircle2 className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
                        {n}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => pick(zone, zone.title)}
                className="w-full h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-sm"
              >
                Clique aqui — Região {zone.number} · R$ {zone.price.toFixed(2).replace(".", ",")}
              </button>
            </div>
          </div>
        );
      })}

    </div>
  );
});

RegionZoneSelector.displayName = "RegionZoneSelector";

