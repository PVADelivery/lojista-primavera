import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { useAuth } from "@/contexts/AuthContext";
import { brl } from "@/lib/format";
import {
  Clock, Truck, Wallet, Plus, MapPin, Phone, CheckCircle2,
  ShoppingBag, ArrowUpRight, Sparkles, Activity, TrendingUp,
  Pencil, Trash2
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/business/")({
  component: BusinessHomePage,
});

function BusinessHomePage() {
  const { profile } = useAuth();
  const { data: company } = useMyCompany();
  const qc = useQueryClient();

  const { data: deliveries = [] } = useQuery({
    queryKey: ["deliveries", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("*")
        .eq("company_id", company!.id)
        .in("status", ["pending", "broadcasted", "accepted", "collecting", "in_route"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stats = {
    pending: deliveries.filter((d: any) => d.status === "pending").length,
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

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/business/delivery-new"
              search={{ edit: undefined }}

              className="inline-flex items-center justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4 mr-2" />Nova Solicitação
            </Link>
            <button className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 font-black text-sm uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]">
              Acompanhar rota
            </button>
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

function DeliveryCard({ d, marketplace, onFinish, onCancel }: any) {
  return (
    <div className="group relative bg-card border border-border rounded-[2rem] p-5 hover:shadow-card hover:border-primary/40 transition-all hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        {marketplace ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-info/10 text-info text-[10px] font-black uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-info" /> Marketplace
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary-foreground text-[10px] font-black uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Manual
          </span>
        )}
        <div className="flex items-center gap-2">
          {/* Edit button: only for manual pending deliveries */}
          {!marketplace && (d.status === "pending" || d.status === "broadcasted") && (
            <Link
              to="/business/delivery-new"
              search={{ edit: d.id }}
              className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground transition-all shadow-sm flex items-center justify-center"
              title="Editar corrida"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
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

      <div className="flex items-start justify-between mt-3 gap-2">
        <p className="font-black text-lg leading-tight line-clamp-1">{d.customer_name ?? "Cliente"}</p>
        {d.short_id && <span className="bg-secondary text-secondary-foreground font-mono text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0">{d.short_id}</span>}
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span className="line-clamp-2">{d.address}</span></p>
        {d.customer_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" /> {d.customer_phone}</p>}
      </div>

      <div className="mt-5 pt-4 border-t border-dashed border-border flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor</p>
          <span className="text-2xl font-black text-primary tracking-tight">{brl(d.value)}</span>
        </div>
        <Button size="sm" onClick={onFinish} className="rounded-xl font-bold">
          <CheckCircle2 className="h-4 w-4 mr-1.5" />Finalizar
        </Button>
      </div>
    </div>
  );
}
