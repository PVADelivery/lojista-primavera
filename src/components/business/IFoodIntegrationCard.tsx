import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Plug,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ExternalLink,
  Layers,
  Package,
  ListPlus,
  Loader2,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";
import { IFoodImportPreviewModal } from "./IFoodImportPreviewModal";

interface IFoodIntegrationCardProps {
  companyId: string;
  onMenuUpdated?: () => void;
}

export function IFoodIntegrationCard({ companyId, onMenuUpdated }: IFoodIntegrationCardProps) {
  const [connection, setConnection] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Modal de Preview & Execução
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isExecutingImport, setIsExecutingImport] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);

  // Estatísticas de produtos vinculados
  const [syncedStats, setSyncedStats] = useState<{ productsCount: number; categoriesCount: number }>({
    productsCount: 0,
    categoriesCount: 0,
  });

  useEffect(() => {
    if (companyId) {
      fetchConnection();
      fetchSyncedStats();
    }
  }, [companyId]);

  const fetchConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ifood_connections")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (!error && data) {
        setConnection(data);
      } else {
        setConnection(null);
      }
    } catch (err) {
      console.error("Erro ao buscar conexão iFood:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncedStats = async () => {
    try {
      const { data: prods } = await supabase
        .from("products")
        .select("id, category")
        .eq("company_id", companyId)
        .eq("external_source", "ifood");

      if (prods) {
        const uniqueCategories = new Set(prods.map((p: any) => p.category).filter(Boolean));
        setSyncedStats({
          productsCount: prods.length,
          categoriesCount: uniqueCategories.size,
        });
      }
    } catch (err) {
      console.error("Erro ao buscar estatísticas de sincronização:", err);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://nptkxlrhrlssdsevpgqe.supabase.co"}/functions/v1/ifood-connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company_id: companyId }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar conexão");

      if (data.url) {
        // Abre a autorização oficial do iFood em uma nova aba
        window.open(data.url, "_blank", "noopener,noreferrer");
        toast.info("A página de autorização do iFood foi aberta em uma nova aba.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao conectar ao iFood");
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenImportPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://nptkxlrhrlssdsevpgqe.supabase.co"}/functions/v1/ifood-import-menu`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company_id: companyId, mode: "preview" }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao consultar catálogo");

      setPreviewData(data);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar prévia do iFood");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    setIsExecutingImport(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://nptkxlrhrlssdsevpgqe.supabase.co"}/functions/v1/ifood-import-menu`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company_id: companyId, mode: "execute" }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha na importação");

      toast.success("Cardápio iFood importado com sucesso!", {
        description: `${data.summary?.products_imported || 0} produtos e ${data.summary?.options_created || 0} complementos sincronizados.`,
      });

      setPreviewOpen(false);
      fetchConnection();
      fetchSyncedStats();
      if (onMenuUpdated) onMenuUpdated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar importação");
    } finally {
      setIsExecutingImport(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Deseja realmente desconectar sua conta do iFood? Os produtos já importados continuarão no seu cardápio.")) {
      return;
    }

    setDisconnecting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://nptkxlrhrlssdsevpgqe.supabase.co"}/functions/v1/ifood-disconnect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company_id: companyId }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao desconectar");

      toast.success("iFood desconectado com sucesso.");
      setConnection(null);
      fetchSyncedStats();
    } catch (err: any) {
      toast.error(err.message || "Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[2.5rem] bg-card border border-border/60 p-6 flex items-center justify-center min-h-[140px]">
        <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
      </div>
    );
  }

  const isConnected = connection && connection.status === "connected";

  return (
    <>
      <div className="rounded-[2.5rem] bg-gradient-to-br from-card to-card/95 border border-border/80 p-6 sm:p-8 shadow-card relative overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          {/* Informações da Integração */}
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-2xl font-black text-rose-500 tracking-tighter">iF</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-black text-foreground tracking-tight">Integração iFood</h3>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-black uppercase tracking-wider">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border/60 text-[11px] font-bold uppercase tracking-wider">
                    Desconectado
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                {isConnected
                  ? `Sua conta iFood (${connection.merchant_name || connection.merchant_id}) está vinculada. Importe e sincronize seu cardápio com grupos de complementos em poucos cliques.`
                  : "Conecte sua conta do iFood para importar seu cardápio completo (produtos, fotos, categorias e complementos) automaticamente para o MT 24 Horas."}
              </p>

              {isConnected && (
                <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1 font-medium">
                    <Package className="h-3.5 w-3.5 text-rose-500" />
                    <strong>{syncedStats.productsCount}</strong> itens vinculados
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Layers className="h-3.5 w-3.5 text-amber-500" />
                    <strong>{syncedStats.categoriesCount}</strong> categorias
                  </span>
                  {connection.last_sync_at && (
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      Última sinc: {new Date(connection.last_sync_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {isConnected ? (
              <>
                <Button
                  onClick={handleOpenImportPreview}
                  disabled={previewLoading || isExecutingImport}
                  className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5 py-5 shadow-lg shadow-rose-500/20 flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Importar / Sincronizar Cardápio
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="rounded-2xl text-rose-500 hover:bg-rose-500/10 font-bold text-xs px-3 py-5"
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-6 py-5 shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Plug className="h-4 w-4" />
                    Conectar iFood
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Prévia e Revisão */}
      <IFoodImportPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onConfirm={handleConfirmImport}
        previewData={previewData}
        isLoading={previewLoading}
        isExecuting={isExecutingImport}
      />
    </>
  );
}
