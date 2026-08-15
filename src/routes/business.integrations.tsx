import { createFileRoute } from "@tanstack/react-router";
import { useMyCompany } from "@/services/companies";
import { IFoodIntegrationCard } from "@/components/business/IFoodIntegrationCard";
import { Layers, Plug, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/business/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { data: company, isLoading } = useMyCompany();

  useEffect(() => {
    // Verifica parâmetros de retorno da autorização do iFood
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    const merchant = params.get("merchant");

    if (success === "connected") {
      toast.success(`Conta do iFood vinculada com sucesso!`, {
        description: merchant ? `Estabelecimento: ${merchant}` : "Agora você pode importar seus produtos.",
      });
      // Limpa os parâmetros da URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      toast.error(`Falha na autorização do iFood: ${error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div>
        <p className="label-tiny uppercase font-black tracking-widest text-primary">Conectividade & Parcerias</p>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Central de Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte seus canais de vendas externos e sincronize cardápios, pedidos e produtos de forma automatizada.
        </p>
      </div>

      {/* Card Oficial iFood */}
      {company?.id ? (
        <IFoodIntegrationCard companyId={company.id} />
      ) : isLoading ? (
        <div className="rounded-[2.5rem] bg-card border border-border p-12 text-center text-xs font-bold text-muted-foreground animate-pulse">
          Carregando dados da empresa...
        </div>
      ) : (
        <div className="rounded-[2.5rem] bg-card border border-border p-12 text-center text-sm text-muted-foreground">
          Nenhuma empresa vinculada ao seu usuário.
        </div>
      )}

      {/* Dicas e Segurança da Integração */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="rounded-2xl bg-card/60 border border-border/60 p-5 space-y-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h4 className="font-black text-sm text-foreground">API Oficial Segura</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A autenticação ocorre via protocolo OAuth 2.0 oficial com tokens criptografados e renovação automática.
          </p>
        </div>

        <div className="rounded-2xl bg-card/60 border border-border/60 p-5 space-y-2">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Layers className="h-5 w-5" />
          </div>
          <h4 className="font-black text-sm text-foreground">Complementos & Grupos</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Adicionais, limites mínimos e máximos e opções com preços extras são importados junto com cada item.
          </p>
        </div>

        <div className="rounded-2xl bg-card/60 border border-border/60 p-5 space-y-2">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
          <h4 className="font-black text-sm text-foreground">Zero Duplicidade</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O sistema faz correspondência inteligente por ID externo, atualizando os registros sem duplicar seu cardápio.
          </p>
        </div>
      </div>
    </div>
  );
}
