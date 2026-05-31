import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { brl } from "@/lib/format";
import { TrendingUp, Wallet, ShoppingBag, ArrowDownCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

export const Route = createFileRoute("/business/finance")({
  component: FinancePage,
});

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))"];

function FinancePage() {
  const { data: company } = useMyCompany();
  const [days, setDays] = useState(7);
  const since = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); }, [days]);

  const { data: orders = [] } = useQuery({
    queryKey: ["fin-orders", company?.id, days],
    enabled: !!company?.id,
    queryFn: async () => {
      return [];
    },
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ["fin-deliveries", company?.id, days],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("*").eq("company_id", company!.id).gte("created_at", since);
      return data ?? [];
    },
  });

  const completedOrders = orders.filter((o: any) => ["delivered","completed"].includes(o.status));
  const revenue = completedOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
  const logistics = deliveries.filter((d: any) => d.status !== "cancelled").reduce((s: number, d: any) => s + Number(d.value), 0);
  const todayOrders = deliveries.filter((o: any) => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.filter((o: any) => ["delivered","completed"].includes(o.status)).reduce((s:number,o:any)=>s+Number(o.value),0);

  // daily series
  const series = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      map.set(d.toISOString().slice(0,10), 0);
    }
    completedOrders.forEach((o: any) => {
      const k = o.created_at.slice(0,10);
      if (map.has(k)) map.set(k, map.get(k)! + Number(o.total));
    });
    return Array.from(map.entries()).map(([d, v]) => ({ d: d.slice(5), v }));
  }, [completedOrders, days]);

  const statusDist = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o: any) => { counts[o.status] = (counts[o.status]||0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const payments = useMemo(() => {
    const counts: Record<string, number> = {};
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="label-tiny">Centro Financeiro</p>
          <h1 className="text-3xl font-black tracking-tight">Sua loja em números</h1>
        </div>
        <div className="flex gap-2">
          {[7,15,30].map(d => (
            <Button key={d} variant={days===d?"default":"outline"} onClick={()=>setDays(d)} className="rounded-xl">{d} dias</Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={TrendingUp} label="Faturamento Marketplace" value={brl(revenue)} tone="primary"/>
        <KPI icon={ShoppingBag} label="Vendas Hoje" value={brl(todayRevenue)} sub={`${todayOrders.length} pedidos`} tone="accent"/>
        <KPI icon={ArrowDownCircle} label="Gasto Logística" value={brl(logistics)} tone="warning"/>
        <KPI icon={Wallet} label="Saldo Líquido" value={brl(revenue - logistics)} tone="success"/>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="overview" className="rounded-xl">Visão Geral</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-xl">Pedidos</TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-xl">Análise</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="bg-card border border-border rounded-[2rem] p-6">
            <h3 className="font-black mb-4">Receita diária</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                <Tooltip contentStyle={{borderRadius:16,border:"1px solid hsl(var(--border))",background:"hsl(var(--card))"}} formatter={(v:any)=>brl(v)}/>
                <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#g)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {statusDist.length > 0 && (
            <div className="bg-card border border-border rounded-[2rem] p-6">
              <h3 className="font-black mb-4">Distribuição por status</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="bg-card border border-border rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary"><tr>
                  <th className="text-left p-3 font-black">ID</th><th className="text-left p-3 font-black">Data</th>
                  <th className="text-left p-3 font-black">Status</th><th className="text-left p-3 font-black">Pagamento</th>
                  <th className="text-right p-3 font-black">Total</th>
                </tr></thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{o.id.slice(0,8)}</td>
                      <td className="p-3">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-bold">{o.status}</span></td>
                      <td className="p-3">{o.payment_method ?? "—"}</td>
                      <td className="p-3 text-right font-bold">{brl(o.total)}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Sem pedidos no período</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <div className="bg-card border border-border rounded-[2rem] p-6">
            <h3 className="font-black mb-4">Por forma de pagamento</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={payments} layout="vertical">
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120}/>
                <Tooltip formatter={(v:any)=>brl(v)} contentStyle={{borderRadius:16}}/>
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0,12,12,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, tone }: any) {
  const tones: any = { primary:"bg-primary/10 text-primary", accent:"bg-accent/10 text-accent", warning:"bg-warning/10 text-warning", success:"bg-success/10 text-success" };
  return (
    <div className="bg-card border border-border rounded-[2rem] p-5">
      <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${tones[tone]}`}><Icon className="h-5 w-5"/></div>
      <p className="label-tiny mt-3">{label}</p>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
