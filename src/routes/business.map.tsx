import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useRegions, useCitiesWithRegions } from "@/services/regions";
import { UnifiedMap } from "@/components/shared/UnifiedMap";
import { MapPin, DollarSign, Loader2, Mail, Send, LinkIcon, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/business/map")({
  component: BusinessMapPage,
});

const CITY_STORAGE_KEY = "pva_selected_city";

function BusinessMapPage() {
  const [integratorEmail, setIntegratorEmail] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);

  // Shared city state
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Data hooks
  const { data: availableCities } = useCitiesWithRegions();
  const { data: regions, isLoading: loading } = useRegions(selectedCityName || undefined);

  // Load saved city on mount
  useEffect(() => {
    const stored = localStorage.getItem(CITY_STORAGE_KEY);
    if (stored) setSelectedCityName(stored);
  }, []);

  const selectCity = (cityName: string | null) => {
    setSelectedCityName(cityName);
    if (cityName) localStorage.setItem(CITY_STORAGE_KEY, cityName);
    else localStorage.removeItem(CITY_STORAGE_KEY);
    setShowCityDropdown(false);
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integratorEmail.trim()) return;
    setSendingRequest(true);
    await new Promise((res) => setTimeout(res, 1200));
    toast.success("Solicitação de integração enviada para o admin.");
    setIntegratorEmail("");
    setSendingRequest(false);
  };

  const activeRegions = regions?.filter((r) => r.active) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
           <p className="label-tiny">Áreas de Atuação</p>
           <h1 className="text-3xl font-black tracking-tight">Mapa de Regiões</h1>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_350px] gap-6">
        <div className="space-y-6">
          {/* Integration request banner */}
          <div className="bg-primary/10 border border-primary/20 rounded-3xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <LinkIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black text-foreground">Solicitar Integração</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Envie sua solicitação ao administrador para vincular seu estabelecimento e liberar acesso completo às configurações de entrega.
                </p>
                <form onSubmit={handleSendRequest} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      value={integratorEmail}
                      onChange={(e) => setIntegratorEmail(e.target.value)}
                      placeholder="E-mail do administrador"
                      className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sendingRequest || !integratorEmail.trim()}
                    className="h-12 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-black disabled:opacity-50 flex items-center gap-2 shrink-0 hover:bg-primary/90 transition-all shadow-glow"
                  >
                    {sendingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="bg-card rounded-[2rem] overflow-hidden shadow-card border border-border" style={{ height: 500 }}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/20">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              
              {/* City selector dropdown */}
              <div className="relative flex-1 max-w-[250px]">
                <button
                  onClick={() => setShowCityDropdown(!showCityDropdown)}
                  className="w-full flex items-center justify-between gap-2 bg-background rounded-xl px-4 py-2 hover:bg-muted transition-all border border-border/50"
                >
                  <span className="text-sm font-bold text-foreground truncate">
                    {selectedCityName || "Todas as cidades"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showCityDropdown ? "rotate-180" : ""}`} />
                </button>

                {showCityDropdown && (
                  <div className="absolute z-50 top-full mt-2 left-0 right-0 bg-card rounded-xl border border-border shadow-2xl overflow-hidden">
                    <button
                      onClick={() => selectCity(null)}
                      className="w-full text-left px-4 py-3 text-xs hover:bg-muted transition-colors border-b border-border text-muted-foreground font-bold"
                    >
                      Mostrar todas
                    </button>
                    {availableCities?.map((city, i) => (
                      <button
                        key={i}
                        onClick={() => selectCity(city)}
                        className="w-full text-left px-4 py-3 text-xs hover:bg-muted transition-colors border-b border-border last:border-0 font-bold text-foreground"
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary">
                <span className="text-xs font-black uppercase tracking-widest">
                  {loading ? "..." : `${activeRegions.length} Regiões`}
                </span>
              </div>
            </div>

            <div className="w-full" style={{ height: "calc(100% - 65px)" }}>
              <UnifiedMap regions={activeRegions} centerCity={null} />
            </div>
          </div>
        </div>

        {/* Regions list sidebar */}
        <div className="bg-card rounded-[2rem] p-6 shadow-card border border-border h-fit">
          <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-5">
            Tabela de preços
          </h3>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-muted rounded-2xl h-16" />
              ))}
            </div>
          ) : activeRegions.length === 0 ? (
            <div className="rounded-2xl p-6 text-center border border-dashed border-border/60">
              <p className="text-sm text-muted-foreground font-medium">Nenhuma região configurada nesta cidade ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeRegions.map((region) => (
                <div
                  key={region.id}
                  className="bg-background rounded-2xl p-4 shadow-sm flex items-center gap-3 border border-border/40 hover:border-primary/30 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `rgba(245, 158, 11, 0.15)` }} // Tailwind amber-500
                  >
                    <MapPin className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{region.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                        {selectedCityName || "Global"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-success/15 px-3 py-1.5 rounded-xl shrink-0">
                    <span className="text-sm font-black text-success tracking-tight">
                      R$ {Number(region.price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
