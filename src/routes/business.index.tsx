import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { useAuth } from "@/contexts/AuthContext";
import { brl } from "@/lib/format";
import {
  Clock, ChefHat, Wallet, ShoppingBag, ArrowUpRight, TrendingUp, Sparkles, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/business/")({
  component: BusinessHomePage,
});

function BusinessHomePage() {
  const { profile } = useAuth();
  const { data: company } = useMyCompany();

  // Fetch orders instead of deliveries
  const { data: orders = [] } = useQuery({
    queryKey: ["dashboard-orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*), customers(name)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todaysOrders = orders.filter((o: any) => new Date(o.created_at) >= today);
  
  const stats = {
    pending: orders.filter((o: any) => o.status === "pending").length,
    preparing: orders.filter((o: any) => o.status === "preparing").length,
    todayRevenue: todaysOrders.filter((o: any) => ["completed", "delivered", "ready", "in_route"].includes(o.status)).reduce((s: number, o: any) => s + Number(o.total || 0), 0),
    totalToday: todaysOrders.length,
  };

  const recentOrders = orders.slice(0, 6);

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
              {stats.pending > 0
                ? `Você tem ${stats.pending} ${stats.pending === 1 ? "pedido aguardando" : "pedidos aguardando"} aceite.`
                : "Tudo sob controle. Nenhum pedido pendente no momento."}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => window.location.href = '/business/orders'}
                className="rounded-2xl h-13 px-7 bg-primary text-primary-foreground hover:bg-primary/90 font-black shadow-glow group"
              >
                <Activity className="h-5 w-5 mr-2" />
                Ir para o Kanban
              </Button>
            </div>
          </div>

          {/* Big metric panel */}
          <div className="relative rounded-3xl bg-white/5 backdrop-blur border border-white/10 p-6">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.25em] opacity-70">
              <span>Receita · hoje</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-5xl sm:text-6xl font-black tracking-tighter text-primary">
              {brl(stats.todayRevenue)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric label="Pedidos Hoje" value={stats.totalToday} />
              <MiniMetric label="Ticket Médio" value={stats.totalToday ? brl(stats.todayRevenue / stats.totalToday) : "R$ 0,00"} isCurrency />
            </div>
          </div>
        </div>
      </section>

      {/* STAT BAND — numbered, editorial */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard n="01" icon={Clock} label="Pendentes" value={stats.pending} hint="aguardando aceite" tone="warning" />
        <StatCard n="02" icon={ChefHat} label="Na Cozinha" value={stats.preparing} hint="sendo preparados" tone="info" />
        <StatCard n="03" icon={ShoppingBag} label="Pedidos Totais" value={stats.totalToday} hint="recebidos hoje" tone="primary" />
      </div>

      <Section title="Últimos Pedidos" kicker="Fluxo recente do marketplace" count={recentOrders.length}>
        {recentOrders.length === 0 ? (
          <EmptyState icon={ShoppingBag} text="Nenhum pedido recebido ainda." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentOrders.map((o: any) => <OrderPreviewCard key={o.id} order={o} />)}
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

function MiniMetric({ label, value, isCurrency }: { label: string; value: number | string, isCurrency?: boolean }) {
  return (
    <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
      <p className={`mt-1 font-black tracking-tight ${isCurrency ? "text-lg" : "text-2xl"}`}>{value}</p>
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

function EmptyState({ icon: Icon, text }: any) {
  return (
    <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function OrderPreviewCard({ order }: any) {
  return (
    <div className="group relative bg-card border border-border rounded-[2rem] p-5 hover:shadow-card hover:border-primary/40 transition-all hover:-translate-y-0.5 cursor-pointer" onClick={() => window.location.href = '/business/orders'}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary-foreground text-[10px] font-black uppercase tracking-widest">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> #{order.id?.slice(-6).toUpperCase()}
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition" />
      </div>

      <p className="mt-3 font-black text-lg leading-tight line-clamp-1">{order.customers?.name || order.customer_name || "Cliente Marketplace"}</p>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <span className="line-clamp-2">
            {order.order_items?.length} {order.order_items?.length === 1 ? 'item' : 'itens'}
          </span>
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-dashed border-border flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Valor</p>
          <span className="text-2xl font-black text-primary tracking-tight">{brl(order.total)}</span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
          order.status === 'pending' ? 'bg-warning/10 text-warning' :
          order.status === 'preparing' ? 'bg-info/10 text-info' :
          order.status === 'ready' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
        }`}>
          {order.status === 'pending' ? 'Novo' : order.status === 'preparing' ? 'Cozinha' : order.status === 'ready' ? 'Pronto' : order.status}
        </span>
      </div>
    </div>
  );
}
