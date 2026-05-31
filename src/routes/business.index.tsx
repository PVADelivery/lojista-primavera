import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { useAuth } from "@/contexts/AuthContext";
import { brl } from "@/lib/format";
import { Clock, Truck, Wallet, Plus, MapPin, Phone, CheckCircle2, ShoppingBag } from "lucide-react";
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

  const today = new Date(); today.setHours(0,0,0,0);
  const stats = {
    pending: deliveries.filter((d: any) => d.status === "pending").length,
    inRoute: deliveries.filter((d: any) => ["in_route","in_transit","accepted","collecting"].includes(d.status)).length,
    todayManual: deliveries.filter((d: any) => new Date(d.created_at) >= today).reduce((s: number, d: any) => s + Number(d.value || 0), 0),
  };

  const manual = deliveries;

  const finishDelivery = async (id: string) => {
    await supabase.from("deliveries").update({ status: "delivered" }).eq("id", id);
    toast.success("Entrega finalizada");
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = profile?.full_name?.split(" ")[0] ?? "lojista";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-info text-primary-foreground p-6 sm:p-8">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 30% 20%, white 1.5px, transparent 1.5px)", backgroundSize:"40px 40px"}}/>
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="opacity-80 text-sm font-semibold">{greeting}, {firstName} 🌿</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight">Painel de Entregas</h1>
            <p className="mt-2 opacity-90">Gerencie suas vendas e entregas em um só lugar.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-white text-primary hover:bg-white/90 rounded-2xl h-12 px-6 font-bold">
            <Plus className="h-4 w-4 mr-2"/> {showForm ? "Voltar" : "Nova Entrega"}
          </Button>
        </div>
      </div>

      {showForm ? (
        <NewDeliveryForm companyId={company?.id} onDone={() => { setShowForm(false); qc.invalidateQueries({queryKey:["deliveries"]}); }}/>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Clock} label="Pendentes" value={stats.pending} tone="warning"/>
            <StatCard icon={Truck} label="Em Rota" value={stats.inRoute} tone="primary"/>
            <StatCard icon={Wallet} label="Hoje (Manual)" value={brl(stats.todayManual)} tone="accent"/>
          </div>

          <Section title="Entregas Manuais" empty={manual.length === 0} emptyText="Crie sua primeira entrega manual.">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {manual.map((d: any) => (
                <DeliveryCard key={d.id} d={d} onFinish={() => finishDelivery(d.id)}/>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  const tones: any = {
    warning: "bg-warning/10 text-warning",
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
  };
  return (
    <div className="bg-card border border-border rounded-[2rem] p-5 hover:shadow-card transition">
      <div className="flex items-center justify-between">
        <p className="label-tiny">{label}</p>
        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${tones[tone]}`}><Icon className="h-5 w-5"/></div>
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function Section({ title, children, empty, emptyText }: any) {
  return (
    <section>
      <h2 className="text-xl font-black tracking-tight mb-3">{title}</h2>
      {empty ? (
        <div className="bg-card border border-dashed border-border rounded-[2rem] p-10 text-center">
          <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/40"/>
          <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : children}
    </section>
  );
}

function DeliveryCard({ d, marketplace, onFinish }: any) {
  return (
    <div className="bg-card border border-border rounded-[2rem] p-5 hover:shadow-card transition">
      {marketplace && <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest">Marketplace</span>}
      <p className="mt-2 font-black text-lg">{d.customer_name ?? "Cliente"}</p>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-2"><MapPin className="h-4 w-4"/> {d.address}</p>
        {d.customer_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4"/> {d.customer_phone}</p>}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-2xl font-black text-primary">{brl(d.value)}</span>
        <Button size="sm" onClick={onFinish} className="rounded-xl"><CheckCircle2 className="h-4 w-4 mr-1"/>Finalizar</Button>
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
    <form onSubmit={submit} className="bg-card border border-border rounded-[2rem] p-6 space-y-4 max-w-2xl">
      <h2 className="font-black text-xl">Nova Entrega</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label>Nome do cliente</Label><Input value={f.customer_name} onChange={(e)=>setF({...f,customer_name:e.target.value})} required className="rounded-xl h-11"/></div>
        <div><Label>Telefone</Label><Input value={f.customer_phone} onChange={(e)=>setF({...f,customer_phone:e.target.value})} className="rounded-xl h-11"/></div>
      </div>
      <div><Label>Endereço de entrega</Label><Input value={f.address} onChange={(e)=>setF({...f,address:e.target.value})} required className="rounded-xl h-11"/></div>
      <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={f.value} onChange={(e)=>setF({...f,value:e.target.value})} required className="rounded-xl h-11"/></div>
      <Button type="submit" disabled={busy} className="rounded-xl h-11 px-6 font-bold">Criar entrega</Button>
    </form>
  );
}
