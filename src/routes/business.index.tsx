import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { useAuth } from "@/contexts/AuthContext";
import { brl } from "@/lib/format";
import {
  Clock, Truck, Wallet, Plus, MapPin, Phone, CheckCircle2,
  ShoppingBag, ArrowUpRight, Sparkles, Activity, TrendingUp,
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
  const [showForm, setShowForm] = useState(false);

  const { data: deliveries = [] } = useQuery({
    queryKey: ["deliveries", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("*")
        .eq("company_id", company!.id)
        .not("status", "in", "(delivered,cancelled,completed)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const stats = {
    pending: deliveries.filter((d: any) => d.status === "pending").length,
    inRoute: deliveries.filter((d: any) => ["in_route", "in_transit", "accepted", "collecting"].includes(d.status)).length,
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profile?.full_name?.split(" ")[0] ?? "lojista";
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
            <h1 className="mt-4 text-[clamp(2.4rem,5.5vw,4.5rem)] font-black leading-[0.95] tracking-tight">
              {greeting},<br />
              <span className="text-primary">{firstName}.</span>
            </h1>
            <p className="mt-4 max-w-md text-base opacity-75">
              {stats.total > 0
                ? `Você tem ${stats.total} ${stats.total === 1 ? "entrega ativa" : "entregas ativas"} acontecendo agora.`
                : "Tudo calmo por aqui. Crie sua primeira entrega do dia."}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                onClick={() => setShowForm(!showForm)}
                size="lg"
                className="rounded-2xl h-13 px-7 bg-primary text-primary-foreground hover:bg-primary/90 font-black shadow-glow group"
              >
                <Plus className="h-5 w-5 mr-2 transition-transform group-hover:rotate-90" />
                {showForm ? "Voltar ao painel" : "Nova entrega"}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="rounded-2xl h-13 px-6 text-[hsl(var(--sidebar-foreground))] hover:bg-white/10 font-bold"
              >
                <Activity className="h-4 w-4 mr-2" /> Acompanhar rota
              </Button>
            </div>
          </div>

          {/* Big metric panel */}
          <div className="relative rounded-3xl bg-white/5 backdrop-blur border border-white/10 p-6">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
              <span>Receita manual · hoje</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-5xl sm:text-6xl font-black tracking-tighter text-primary">
              {brl(stats.todayManual)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric label="Pendentes" value={stats.pending} />
              <MiniMetric label="Em rota" value={stats.inRoute} />
            </div>
          </div>
        </div>
      </section>

      {showForm ? (
        <NewDeliveryForm companyId={company?.id} onDone={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["deliveries"] }); }} />
      ) : (
        <>
          {/* STAT BAND — numbered, editorial */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard n="01" icon={Clock} label="Pendentes" value={stats.pending} hint="aguardando coleta" tone="warning" />
            <StatCard n="02" icon={Truck} label="Em rota" value={stats.inRoute} hint="entregadores ativos" tone="info" />
            <StatCard n="03" icon={Wallet} label="Receita manual" value={brl(stats.todayManual)} hint="vendas diretas hoje" tone="primary" />
          </div>

          <Section title="Marketplace" kicker="Entregas geradas por pedidos online" count={marketplace.length}>
            {marketplace.length === 0 ? (
              <EmptyState icon={ShoppingBag} text="Nenhum pedido em entrega no momento." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {marketplace.map((d: any) => <DeliveryCard key={d.id} d={d} marketplace onFinish={() => finishDelivery(d.id)} />)}
              </div>
            )}
          </Section>

          <Section title="Manuais" kicker="Entregas criadas direto por você" count={manual.length}>
            {manual.length === 0 ? (
              <EmptyState icon={Sparkles} text="Crie sua primeira entrega manual em segundos." action={
                <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl font-bold">
                  <Plus className="h-4 w-4 mr-2" />Nova entrega
                </Button>
              } />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {manual.map((d: any) => <DeliveryCard key={d.id} d={d} onFinish={() => finishDelivery(d.id)} />)}
              </div>
            )}
          </Section>
        </>
      )}

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

function DeliveryCard({ d, marketplace, onFinish }: any) {
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
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition" />
      </div>

      <p className="mt-3 font-black text-lg leading-tight line-clamp-1">{d.customer_name ?? "Cliente"}</p>

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

function NewDeliveryForm({ companyId, onDone }: { companyId?: string; onDone: () => void }) {
  const [f, setF] = useState({ customer_name: "", customer_phone: "", address: "", value: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setBusy(true);
    const { error } = await supabase.from("deliveries").insert({
      company_id: companyId,
      customer_name: f.customer_name,
      customer_phone: f.customer_phone,
      address: f.address,
      value: Number(f.value || 0),
      status: "pending",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Entrega criada!"); onDone(); }
  };
  return (
    <form onSubmit={submit} className="bg-card border border-border rounded-[2.5rem] p-8 space-y-5 max-w-2xl">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">Cadastro rápido</p>
        <h2 className="mt-1 font-black text-3xl tracking-tight">Nova entrega</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label>Nome do cliente</Label><Input value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} required className="rounded-xl h-11 mt-1.5" /></div>
        <div><Label>Telefone</Label><Input value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} className="rounded-xl h-11 mt-1.5" /></div>
      </div>
      <div><Label>Endereço de entrega</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required className="rounded-xl h-11 mt-1.5" /></div>
      <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required className="rounded-xl h-11 mt-1.5" /></div>
      <Button type="submit" disabled={busy} size="lg" className="rounded-xl h-12 px-7 font-black shadow-glow">
        {busy ? "Criando..." : "Criar entrega"}
      </Button>
    </form>
  );
}
