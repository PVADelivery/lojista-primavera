import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { brl } from "@/lib/format";
import { Clock, ChefHat, PackageCheck, Truck, CheckCircle2, ShoppingBag, Volume2, VolumeX, Printer, XCircle, Timer, Phone, MapPin, User, LayoutGrid } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

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

const STATUS_LABELS: Record<string, string> = {
  pending: "Novo",
  preparing: "Cozinha",
  ready: "Pronto",
  in_route: "Em Rota",
  delivered: "Concluído",
  cancelled: "Cancelado",
};

function OrdersPage() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  const [muted, setMuted] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*), customers(name, phone)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false }).limit(200);
      
      // Filter out old completed/cancelled orders to keep board clean
      const today = new Date();
      today.setHours(0,0,0,0);
      return (data ?? []).filter(o => {
        if (["delivered", "cancelled"].includes(o.status) && new Date(o.created_at) < today) return false;
        return true;
      });
    },
    refetchInterval: 10000,
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
    
    // Otimistic update
    qc.setQueryData(["orders", company?.id], (old: any) => {
      if (!old) return old;
      return old.map((o: any) => o.id === id ? { ...o, status: next } : o);
    });

    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) {
      toast.error("Erro ao mover pedido.");
      qc.invalidateQueries({ queryKey: ["orders"] });
    } else {
      toast.success(`Pedido movido para ${STATUS_LABELS[next]}`);
    }
  };

  const cancelOrder = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["orders"] });
    toast.error("Pedido cancelado.");
  };

  const handlePrint = (order: any) => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>OS #${order.id.slice(0, 8)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .label { color: #666; font-size: 11px; text-transform: uppercase; margin-top: 12px; }
        .value { font-weight: bold; margin-bottom: 8px; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 16px 0; }
        .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #999; }
      </style></head><body>
        <h1>Primavera Delivery</h1>
        <p style="color:#666;margin-top:0">Comanda de Pedido</p>
        <hr/>
        <div class="label">Pedido</div>
        <div class="value">#${order.id.slice(0, 8).toUpperCase()}</div>
        <div class="label">Cliente</div>
        <div class="value">${order.customers?.name || order.customer_name || "Cliente"} (${order.customers?.phone || order.customer_phone || "S/N"})</div>
        <div class="label">Endereço</div>
        <div class="value">${order.delivery_address || "Retirada/Balcão"}</div>
        <div class="label">Status</div>
        <div class="value">${STATUS_LABELS[order.status] || order.status}</div>
        <div class="label">Forma de Pagamento</div>
        <div class="value">${order.payment_method || "Não informada"}</div>
        <hr/>
        <div class="label">Itens do Pedido</div>
        <div style="margin-top:8px">
          ${order.order_items?.map((i: any) => `
            <div style="margin-bottom:8px">
              <strong>${i.quantity}x</strong> ${i.product_name || "Produto"} - R$ ${(i.price * i.quantity).toFixed(2)}
              ${i.notes ? `<br/><small style="color:#666">Obs: ${i.notes}</small>` : ""}
            </div>
          `).join('') || "Nenhum item encontrado."}
        </div>
        <hr/>
        <div class="label">Total do Pedido</div>
        <div class="value" style="font-size:16px">R$ ${Number(order.total || 0).toFixed(2).replace('.', ',')}</div>
        <div class="label">Data/Hora</div>
        <div class="value">${format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</div>
        <hr/>
        <div class="footer">Impresso em ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const todayRevenue = orders.filter((o: any) => ["delivered", "in_route", "ready"].includes(o.status))
    .reduce((s: number, o: any) => s + Number(o.total), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="label-tiny">Operação</p>
          <h1 className="text-3xl font-black tracking-tight">Gestão de Pedidos</h1>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
             <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-warning/20 text-warning font-black text-xs uppercase tracking-widest animate-pulse border border-warning/30">
               <Clock className="h-4 w-4" />
               {pending} {pending === 1 ? 'Novo Pedido' : 'Novos Pedidos'}
             </div>
          )}
          <div className="px-4 py-2 rounded-2xl bg-success/10 text-success">
            <p className="label-tiny">Receita hoje (Aprovada)</p>
            <p className="font-black">{brl(todayRevenue)}</p>
          </div>
          <Button variant="outline" onClick={() => setMuted(!muted)} className="rounded-2xl">
            {muted ? <VolumeX className="h-4 w-4"/> : <Volume2 className="h-4 w-4"/>}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 custom-scrollbar snap-x">
        {COLUMNS.map((col) => {
          const items = orders.filter((o: any) => o.status === col.status);
          return (
            <div key={col.status} className="flex-none w-[320px] snap-start flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-6 rounded-full bg-${col.color}`} />
                  <h3 className="font-black text-sm text-foreground uppercase tracking-wider">{col.label}</h3>
                </div>
                <span className="bg-muted px-2.5 py-1 rounded-xl text-xs font-black text-muted-foreground">{items.length}</span>
              </div>

              <div className="space-y-3 h-[70vh] overflow-y-auto custom-scrollbar bg-muted/10 rounded-[2rem] p-2 border border-border/50">
                {items.length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-6 opacity-40">
                     <LayoutGrid className="h-8 w-8 mb-2 stroke-1" />
                     <p className="text-[10px] font-bold uppercase tracking-widest">Vazio</p>
                  </div>
                )}
                {items.map((order: any) => {
                  const age = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
                  const isPending = order.status === "pending";

                  return (
                    <div key={order.id} className={`bg-card border border-border/60 rounded-[1.5rem] p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30 group relative overflow-hidden ${isPending ? "border-warning/40 bg-warning/[0.02]" : ""}`}>
                      {isPending && (
                        <div className="absolute top-0 right-0 px-3 py-1 bg-warning text-white text-[8px] font-black uppercase tracking-widest rounded-bl-xl">
                          Novo
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight opacity-60">Pedido</span>
                          <p className="font-black text-lg text-foreground tracking-tight leading-none">#{order.id?.slice(-6).toUpperCase()}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border/40">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground truncate leading-tight">{order.customers?.name || order.customer_name || "Cliente"}</p>
                          <p className="text-[10px] text-primary font-bold flex items-center gap-1 mt-0.5">
                             <Phone className="h-2.5 w-2.5" /> {order.customers?.phone || order.customer_phone || "Não informado"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                          <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                            <Timer className="h-3 w-3" /> {age} min
                          </p>
                          <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                            {order.payment_method || 'Não Informado'}
                          </p>
                      </div>

                      <div className="space-y-1.5 mb-4 max-h-24 overflow-y-auto custom-scrollbar">
                        {order.order_items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex flex-col text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md leading-none">{item.quantity}x</span>
                              <span className="font-bold text-foreground/80 truncate leading-none">{item.product_name}</span>
                            </div>
                            {item.notes && (
                              <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded mt-0.5 ml-8 self-start font-medium border border-warning/20">
                                Obs: {item.notes}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 pt-3 border-t border-dashed border-border/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60">Total</span>
                          <p className="text-lg font-black text-primary tracking-tighter italic leading-none">{brl(order.total)}</p>
                        </div>
                        
                        <div className="flex gap-2 mt-1">
                          {isPending && (
                            <button 
                              onClick={() => cancelOrder(order.id)}
                              className="w-10 h-10 rounded-xl bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all shrink-0"
                              title="Cancelar Pedido"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          )}
                          <button 
                            onClick={() => handlePrint(order)}
                            className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-foreground hover:text-background transition-all shrink-0"
                            title="Imprimir Comanda"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <button 
                              onClick={() => advance(order.id, order.status)}
                              className={`flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-1.5
                                ${isPending ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20' : 
                                'bg-foreground text-background hover:bg-foreground/90'}`}
                            >
                              {order.status === "pending" ? "Aceitar Pedido" : 
                               order.status === "preparing" ? "Marcar Pronto" : 
                               order.status === "ready" ? "Despachar" : "Concluir"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

