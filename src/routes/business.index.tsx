import { Link, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { useCredits } from "@/services/credits";
import { useAuth } from "@/contexts/AuthContext";
import { brl } from "@/lib/format";
import {
  Clock, Truck, Wallet, Plus, MapPin, Phone, CheckCircle2,
  ShoppingBag, ArrowUpRight, Sparkles, Activity, TrendingUp,
  Pencil, Trash2
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/business/")({
  component: BusinessHomePage,
});

function BusinessHomePage() {
  const { profile } = useAuth();
  const { data: company } = useMyCompany();
  const { balance: creditBalance, isLow: creditsLow } = useCredits();
  const qc = useQueryClient();

  const { data: deliveries = [] } = useQuery({
    queryKey: ["deliveries", company?.id, profile?.user_id],
    enabled: true,
    queryFn: async () => {
      let query = supabase.from("deliveries").select(`
        *,
        delivery_drivers (
          id,
          full_name,
          phone,
          vehicle_type
        )
      `);
      
      if (company?.id) {
        query = query.eq("company_id", company.id);
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
      
      if (error) {
        console.error("[ERRO SUPABASE]", error);
        return [];
      }

      return (data ?? []).filter((d: any) => d.status !== "delivered" && d.status !== "cancelled" && d.status !== "completed");
    },
  });

  // Sincronização em tempo real silenciosa: atualiza apenas a lista de entregas do painel sem refresh na página e sem interferir em nenhum formulário
  useEffect(() => {
    const channel = supabase
      .channel(`business-deliveries-realtime-${company?.id || profile?.user_id || "global"}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["deliveries"] });
          qc.invalidateQueries({ queryKey: ["credits"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, profile?.user_id, qc]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stats = {
    pending: deliveries.filter((d: any) => ["pending", "broadcasted"].includes(d.status)).length,
    inRoute: deliveries.filter((d: any) => ["in_route", "accepted", "collecting"].includes(d.status)).length,
    todayManual: deliveries.filter((d: any) => !d.order_id && new Date(d.created_at) >= today).reduce((s: number, d: any) => s + Number(d.value || 0), 0),
    total: deliveries.length,
  };

  const marketplace = deliveries.filter((d: any) => d.order_id);
  const manual = deliveries.filter((d: any) => !d.order_id);

  const finishDelivery = async (id: string) => {
    await supabase.from("deliveries").update({ status: "delivered" }).eq("id", id);
    toast.success("Entrega finalizada");
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const cancelDelivery = async (id: string) => {
    if (!confirm("Deseja realmente cancelar esta entrega?")) return;
    const { error } = await supabase.from("deliveries").update({ status: "cancelled" }).eq("id", id);
    if (error) {
      toast.error("Erro ao cancelar entrega: " + error.message);
    } else {
      toast.success("Entrega cancelada");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const companyName = company?.name || profile?.full_name?.split(" ")[0] || "lojista";
  const now = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* HERO — editorial, asymmetric */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
        {/* glow blob */}
        <div className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[360px] w-[360px] rounded-full bg-info/20 blur-3xl" />
        {/* grain */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />

        <div className="relative p-6 sm:p-10 grid lg:grid-cols-[1.4fr_1fr] gap-8 items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] opacity-70">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Ao vivo · {now}
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight leading-none sm:text-5xl">
              {greeting},<br />
              <span className="text-primary">{companyName}.</span>
            </h1>
            <p className="mt-4 text-sm font-medium opacity-80 max-w-md leading-relaxed">
              {stats.total > 0
                ? `Você tem ${stats.total} entrega${stats.total > 1 ? "s" : ""} ativa${stats.total > 1 ? "s" : ""} acontecendo agora.`
                : "Tudo calmo por aqui. Crie sua primeira entrega do dia."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Cartão de Crédito de Entregas */}
            <Link
              to="/business/finance"
              className={`flex items-center gap-3.5 px-6 py-2.5 min-h-[52px] rounded-2xl transition-all shadow-md ${
                creditsLow
                  ? "bg-destructive/15 border border-destructive/30 text-destructive animate-pulse"
                  : "bg-card border border-border/80 text-foreground hover:border-primary/40 hover:shadow-lg"
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Wallet className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left leading-tight py-0.5 whitespace-nowrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Saldo de Créditos</span>
                <span className="mt-0.5 font-display text-lg font-black tracking-tight text-foreground">
                  {Math.floor(Number(creditBalance ?? 0))}
                </span>
              </div>
            </Link>

            <Link
              to="/business/delivery-new"
              search={{ edit: undefined }}
              className="inline-flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />Nova Solicitação
            </Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard n="01" icon={Clock} label="Pendentes" value={stats.pending} hint="aguardando coleta" tone="warning" />
        <StatCard n="02" icon={Truck} label="Em rota" value={stats.inRoute} hint="entregadores ativos" tone="info" />
        <StatCard n="03" icon={Wallet} label="Receita manual" value={brl(stats.todayManual)} hint="vendas diretas hoje" tone="primary" />
      </section>

      {/* MARKETPLACE */}
      <Section title="Marketplace" kicker="Entregas geradas por pedidos online" count={marketplace.length}>
        {marketplace.length === 0 ? (
          <EmptyState icon={ShoppingBag} text="Nenhum pedido em entrega no momento." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {marketplace.map((d: any) => <DeliveryCard key={d.id} d={d} marketplace onFinish={() => finishDelivery(d.id)} onCancel={() => cancelDelivery(d.id)} />)}
          </div>
        )}
      </Section>

      {/* MANUAL */}
      <Section title="Manuais" kicker="Entregas criadas direto por você" count={manual.length}>
        {manual.length === 0 ? (
          <EmptyState icon={Sparkles} text="Crie sua primeira entrega manual em segundos." action={
            <Link
              to="/business/delivery-new"
              search={{ edit: undefined }}

              className="inline-flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-4 rounded-xl font-bold"
            >
              <Plus className="h-4 w-4 mr-2" />Nova entrega
            </Link>
          } />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {manual.map((d: any) => (
              <DeliveryCard 
                key={d.id} 
                d={d} 
                onFinish={() => finishDelivery(d.id)} 
                onCancel={() => cancelDelivery(d.id)} 
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 flex justify-center opacity-40 select-none pointer-events-none">
        <span className="text-[10px] font-black tracking-[0.5em] text-muted-foreground uppercase">
          BONASOFT
        </span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function StatCard({ n, icon: Icon, label, value, hint, tone }: any) {
  const tones: any = {
    warning: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
    info: { bg: "bg-info/10", text: "text-info", ring: "ring-info/20" },
    primary: { bg: "bg-primary/15", text: "text-primary-foreground", ring: "ring-primary/30" },
  };
  const t = tones[tone];
  return (
    <div className={`group relative overflow-hidden bg-card border border-border rounded-[2rem] p-6 hover:shadow-card transition-all hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-black tracking-[0.25em] text-muted-foreground/60">{n}</span>
        <div className={`h-11 w-11 rounded-2xl ${t.bg} flex items-center justify-center ring-1 ${t.ring}`}>
          <Icon className={`h-5 w-5 ${tone === "primary" ? "text-primary" : t.text}`} />
        </div>
      </div>
      <p className="mt-6 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-4xl font-black tracking-tighter">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <div className={`absolute -bottom-1 -right-1 h-24 w-24 rounded-full ${t.bg} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`} />
    </div>
  );
}

function Section({ title, kicker, count, children }: any) {
  return (
    <section>
      <div className="flex items-end justify-between mb-4 gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kicker}</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight flex items-baseline gap-3">
            {title}
            <span className="text-base font-bold text-muted-foreground tabular-nums">— {String(count).padStart(2, "0")}</span>
          </h2>
        </div>
        <div className="hidden sm:block flex-1 border-b border-dashed border-border/80 mb-3" />
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, text, action }: any) {
  return (
    <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

function DeliveryCard({ d, marketplace, onCancel }: any) {
  const navigate = useNavigate();
  const isPending = d.status === "pending" || d.status === "broadcasted";
  const isAccepted = d.status === "accepted";
  const isCollecting = d.status === "collecting";
  const isInRoute = d.status === "in_route" || d.status === "in_transit";
  const isEditable = d.status !== "delivered" && d.status !== "completed" && d.status !== "cancelled";

  // Determinar etapa de progresso (0 = Aguardando, 1 = Aceita, 2 = Coletando, 3 = Em Rota)
  const stepIndex = isInRoute ? 3 : isCollecting ? 2 : isAccepted ? 1 : 0;

  const steps = [
    { label: "Pendente", active: true },
    { label: "Aceito", active: stepIndex >= 1 },
    { label: "Coleta", active: stepIndex >= 2 },
    { label: "Em Rota", active: stepIndex >= 3 },
  ];

  return (
    <div className="group relative overflow-hidden bg-card border border-border/80 rounded-[2rem] p-5 shadow-sm hover:shadow-card hover:border-primary/50 transition-all duration-300 hover:-translate-y-0.5">
      {/* Top Header: Origem da Corrida & Ações */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          {d.delivery_type === "BUSCA_CONDICIONAL" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[11px] font-black uppercase tracking-wider border border-purple-500/30">
              <span className="h-2 w-2 rounded-full bg-purple-500" /> Busca de Condicional
            </span>
          ) : marketplace ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-info/10 text-info text-[11px] font-black uppercase tracking-wider border border-info/20">
              <span className="h-2 w-2 rounded-full bg-info" /> Marketplace
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-black uppercase tracking-wider border border-primary/25">
              <span className="h-2 w-2 rounded-full bg-primary" /> Manual
            </span>
          )}
          {d.short_id && (
            <span className="bg-muted px-2 py-0.5 rounded-lg text-muted-foreground font-mono text-[10px] font-black border border-border/60">
              #{d.short_id}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Edit button: for all active manual deliveries */}
          {!marketplace && isEditable && (
            <button
              type="button"
              onClick={() => navigate({ to: "/business/delivery-new", search: { edit: d.id } })}
              className="p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-black transition-all shadow-sm flex items-center justify-center border border-amber-500/40 shrink-0"
              title="Editar corrida"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Cancel button: for all active deliveries */}
          {d.status !== "delivered" && d.status !== "completed" && d.status !== "cancelled" && (
            <button
              onClick={onCancel}
              className="p-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all shadow-sm flex items-center justify-center"
              title="Cancelar corrida"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cliente & Valor */}
      <div className="mt-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
          <p className="font-extrabold text-base sm:text-lg text-foreground tracking-tight truncate">
            {d.customer_name ?? "Cliente"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor</p>
          <p className="text-xl sm:text-2xl font-black text-primary tracking-tight">{brl(d.value)}</p>
        </div>
      </div>

      {/* Endereço & Telefone */}
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground bg-muted/30 p-3 rounded-2xl border border-border/40">
        <p className="flex items-start gap-2 leading-relaxed">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <span className="line-clamp-2 text-foreground/90 font-medium">{d.address}</span>
        </p>
        {d.customer_phone && (
          <p className="flex items-center gap-2 font-medium">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{d.customer_phone}</span>
          </p>
        )}
      </div>

      {/* Entregador Designado (Se houver) */}
      {d.delivery_drivers && (
        <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
              🏍️
            </span>
            <div>
              <p className="text-[9px] uppercase font-bold text-muted-foreground">Entregador</p>
              <p className="font-bold text-foreground">{d.delivery_drivers.full_name}</p>
            </div>
          </div>
          {d.delivery_drivers.phone && (
            <a
              href={`tel:${d.delivery_drivers.phone}`}
              className="text-[11px] font-bold text-primary hover:underline"
            >
              Ligar
            </a>
          )}
        </div>
      )}

      {/* Barra de Progresso Visual de 4 Etapas */}
      <div className="mt-4 pt-3 border-t border-dashed border-border/60">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Status da Entrega
          </span>
          <span
            className={cn(
              "text-[10px] font-black uppercase px-2 py-0.5 rounded-md",
              isInRoute
                ? "bg-emerald-500/20 text-emerald-400"
                : isCollecting
                ? "bg-amber-500/20 text-amber-400"
                : isAccepted
                ? "bg-blue-500/20 text-blue-400"
                : "bg-muted text-muted-foreground animate-pulse"
            )}
          >
            {isInRoute ? "🏍️ Em rota" : isCollecting ? "📦 Em coleta" : isAccepted ? "✅ Aceita" : "⏳ Aguardando"}
          </span>
        </div>

        {/* Linha de progresso */}
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {steps.map((s, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-2 w-full rounded-full transition-all duration-500",
                  idx <= stepIndex
                    ? idx === 3
                      ? "bg-emerald-500"
                      : idx === 2
                      ? "bg-amber-500"
                      : idx === 1
                      ? "bg-blue-500"
                      : "bg-primary"
                    : "bg-muted/70"
                )}
              />
              <span
                className={cn(
                  "text-[9px] font-bold tracking-tight",
                  idx <= stepIndex ? "text-foreground font-black" : "text-muted-foreground/50"
                )}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
