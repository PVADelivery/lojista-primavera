import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { brl } from "@/lib/format";
import { Clock, ChefHat, PackageCheck, Truck, CheckCircle2, ShoppingBag, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/business/orders")({
  component: OrdersPage,
});

const COLUMNS = [
  { status: "pending", label: "Novos", icon: Clock, color: "warning" },
  { status: "preparing", label: "Na Cozinha", icon: ChefHat, color: "info" },
  { status: "ready", label: "Prontos", icon: PackageCheck, color: "success" },
  { status: "in_route", label: "Em Rota", icon: Truck, color: "primary" },
  { status: "delivered", label: "Concluídos", icon: CheckCircle2, color: "success" },
];

function OrdersPage() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  const [muted, setMuted] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const pending = orders.filter((o: any) => o.status === "pending").length;

  useEffect(() => {
    if (!audio.current) {
      audio.current = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
    }
    if (pending > 0 && !muted) {
      audio.current?.play().catch(() => {});
    }
  }, [pending, muted]);

  const advance = async (id: string, current: string) => {
    const flow: any = { pending: "preparing", preparing: "ready", ready: "in_route", in_route: "delivered" };
    const next = flow[current];
    if (!next) return;
    await supabase.from("deliveries").update({ status: next }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success(`Pedido movido para ${next}`);
  };

  const todayRevenue = orders.filter((o: any) => o.status === "delivered" && new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((s: number, o: any) => s + Number(o.value), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="label-tiny">Operação</p>
          <h1 className="text-3xl font-black tracking-tight">Pedidos do Marketplace</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-2xl bg-success/10 text-success">
            <p className="label-tiny">Receita hoje</p>
            <p className="font-black">{brl(todayRevenue)}</p>
          </div>
          <Button variant="outline" onClick={() => setMuted(!muted)} className="rounded-2xl">
            {muted ? <VolumeX className="h-4 w-4"/> : <Volume2 className="h-4 w-4"/>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {COLUMNS.map((col) => {
          const items = orders.filter((o: any) => o.status === col.status);
          return (
            <div key={col.status} className="bg-card border border-border rounded-[2rem] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <col.icon className={`h-4 w-4 text-${col.color}`}/>
                  <p className="font-black text-sm">{col.label}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-black">{items.length}</span>
              </div>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>}
                {items.map((o: any) => (
                  <div key={o.id} className="bg-secondary/50 rounded-2xl p-3 hover:bg-secondary transition cursor-pointer">
                    <p className="font-black text-sm">{o.customer_name ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{o.address}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-black text-primary">{brl(o.value)}</span>
                      {o.status !== "delivered" && o.status !== "cancelled" && (
                        <button onClick={() => advance(o.id, o.status)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Avançar →</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40"/>
          <p className="mt-3 text-muted-foreground">Nenhum pedido recebido ainda. Quando chegar, você será avisado!</p>
        </div>
      )}
    </div>
  );
}
