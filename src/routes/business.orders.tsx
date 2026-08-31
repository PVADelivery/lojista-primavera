import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { brl } from "@/lib/format";
import { Clock, ChefHat, PackageCheck, Truck, CheckCircle2, ShoppingBag, Volume2, VolumeX, Printer, XCircle, Timer, Phone, MapPin, User, LayoutGrid, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import OrderDetailModal from "@/components/business/OrderDetailModal";
import { useAudioAlert } from "@/hooks/useAudioAlert";
import { resolveRegionDeliveryFee } from "@/lib/pricingResolver";

export const Route = createFileRoute("/business/orders")({
  component: OrdersPage,
});

type OrderStatus = "pending" | "preparing" | "ready" | "in_route" | "delivered" | "cancelled";

const COLUMNS = [
  { status: "pending", label: "Novos", icon: Clock, color: "warning" },
  { status: "preparing", label: "Na Cozinha", icon: ChefHat, color: "blue-500" },
  { status: "ready", label: "Prontos", icon: PackageCheck, color: "success" },
  { status: "in_route", label: "Em Rota", icon: Truck, color: "purple-500" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Novo",
  preparing: "Cozinha",
  ready: "Pronto",
  in_route: "Em Rota",
  delivered: "Concluído",
  cancelled: "Cancelado",
};

const ALLOWED_MANUAL_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  in_route: "delivered",
};

function OrdersPage() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  const [muted, setMuted] = useState(false);
  const { playAlert, stopAlert } = useAudioAlert();

  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState("0,00");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [busyDispatch, setBusyDispatch] = useState(false);

  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data } = await supabase.from("regions").select("*").order("name");
      return data || [];
    },
  });

  const { data: hoods = [] } = useQuery({
    queryKey: ["region_neighborhoods"],
    queryFn: async () => {
      const { data } = await supabase.from("region_neighborhoods").select("*");
      return data || [];
    },
  });

  const { data: pricingRules = [] } = useQuery({
    queryKey: ["pricing_rules", company?.id, company?.pricing_table_id],
    enabled: !!company?.id,
    queryFn: async () => {
      try {
        const { data } = await supabase.rpc("get_company_pricing_rules", { p_company_id: company!.id });
        if (data && Array.isArray(data) && data.length > 0) return data;
      } catch {}

      if (company?.pricing_table_id) {
        const { data } = await supabase
          .from("pricing_rules")
          .select("*")
          .eq("pricing_table_id", company.pricing_table_id);
        if (data && data.length > 0) return data;
      }

      const { data } = await supabase.from("pricing_rules").select("*");
      return data || [];
    },
  });

  // Controle Transacional Rigoroso (Kanban Loop Bug Fix)
  const processingOrderIdsRef = useRef<Set<string>>(new Set());
  const [processingOrderIds, setProcessingOrderIds] = useState<Set<string>>(new Set());

  const acquireLock = (id: string) => {
    if (processingOrderIdsRef.current.has(id)) return false;
    processingOrderIdsRef.current.add(id);
    setProcessingOrderIds(new Set(processingOrderIdsRef.current));
    return true;
  };

  const releaseLock = (id: string) => {
    processingOrderIdsRef.current.delete(id);
    setProcessingOrderIds(new Set(processingOrderIdsRef.current));
  };

  const { data: orders = [], refetch: fetchOrders } = useQuery({
    queryKey: ["orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*), customers(name, phone)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false }).limit(200);
      
      const today = new Date();
      today.setHours(0,0,0,0);
      return (data ?? []).filter(o => {
        if (["delivered", "cancelled"].includes(o.status) && new Date(o.created_at) < today) return false;
        return true;
      });
    },
    refetchOnWindowFocus: false,
  });

  // Atualização em Tempo Real quando uma NOVA VENDA ocorrer no marketplace
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel(`lojista-orders-realtime-${company.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["orders", company.id] });
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, qc, fetchOrders]);

  const pendingCount = orders.filter((o: any) => o.status === "pending").length;

  useEffect(() => {
    if (pendingCount > 0 && !muted) {
      playAlert(true);
    } else {
      stopAlert();
    }
  }, [pendingCount, muted, playAlert, stopAlert]);

  const advance = async (orderId: string, expectedStatus: string) => {
    if (!acquireLock(orderId)) return false;

    const allowedNextStatus = ALLOWED_MANUAL_TRANSITIONS[expectedStatus as OrderStatus];

    if (!allowedNextStatus) {
      toast.error(`Transição não permitida a partir de: ${STATUS_LABELS[expectedStatus]}`);
      releaseLock(orderId);
      return false;
    }

    try {
      // Compare-and-Set para evitar Race Condition
      const { data, error } = await supabase
        .from("orders")
        .update({ status: allowedNextStatus })
        .eq("id", orderId)
        .eq("status", expectedStatus)
        .select("id, status")
        .maybeSingle();

      if (error || !data) {
        toast.warning("O status deste pedido foi atualizado em outra sessão. Sincronizando...");
        qc.invalidateQueries({ queryKey: ["orders"] });
        return false;
      }
      
      if (allowedNextStatus === "delivered") {
        toast.success("Pedido concluído com sucesso e arquivado no Histórico!");
      } else {
        toast.success(`Pedido movido para ${STATUS_LABELS[allowedNextStatus]}`);
      }
      qc.invalidateQueries({ queryKey: ["orders"] });
      return true;
    } catch (err) {
      toast.error("Erro crítico ao avançar pedido.");
      return false;
    } finally {
      releaseLock(orderId);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;
    if (!acquireLock(orderId)) return;
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    qc.invalidateQueries({ queryKey: ["orders"] });
    toast.error("Pedido cancelado.");
    releaseLock(orderId);
  };

  const handleDispatchOrder = async (order: any) => {
    if (!company) return;

    // Se for Retirada no Local, avança o status direto sem chamar motoboy
    const isPickup = order.fulfillment_mode === "pickup" || (order.notes && order.notes.includes("[RETIRADA NO LOCAL]"));
    if (isPickup) {
      await advance(order.id, order.status);
      return;
    }

    // 1. Identifica a região do endereço de entrega
    let resolvedRegionId = order.region_id || "";
    let targetRegion: any = null;

    const rawAddr = String(order.delivery_address || "");
    const cleanAddr = rawAddr
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    // Função de normalização de termos brasileiros
    const norm = (s: string) => s
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\bjardim\b/g, "jd")
      .replace(/\bsanto\b/g, "sto")
      .replace(/\bsanta\b/g, "sta")
      .replace(/\bsao\b/g, "s")
      .replace(/\bparque\b/g, "pq")
      .replace(/\bdistrito industrial\b/g, "industrial")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const normAddr = norm(rawAddr);

    if (!resolvedRegionId && normAddr && hoods.length > 0) {
      const matchedHood = hoods.find((h: any) => {
        if (!h.name) return false;
        const normH = norm(h.name);
        const cleanH = h.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        return (
          (normH && normAddr.includes(normH)) ||
          (cleanH && cleanAddr.includes(cleanH)) ||
          (normAddr && normH.includes(normAddr))
        );
      });
      if (matchedHood) {
        resolvedRegionId = matchedHood.region_id;
      }
    }

    if (resolvedRegionId && regions.length > 0) {
      targetRegion = regions.find((r: any) => String(r.id).toLowerCase() === String(resolvedRegionId).toLowerCase());
    }

    if (!targetRegion && regions.length > 0) {
      const matchedReg = regions.find((r: any) => {
        if (!r.name) return false;
        const normReg = norm(r.name);
        const cleanReg = r.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const parts = r.name.split("/").map((p: string) => norm(p)).filter(Boolean);
        return (
          (normReg && normAddr.includes(normReg)) ||
          (cleanReg && cleanAddr.includes(cleanReg)) ||
          parts.some((p: string) => p && normAddr.includes(p))
        );
      });
      if (matchedReg) {
        resolvedRegionId = matchedReg.id;
        targetRegion = matchedReg;
      }
    }

    if (!targetRegion && regions.length > 0) {
      targetRegion = regions[0];
      resolvedRegionId = regions[0].id;
    }

    // 2. Calcula o valor oficial que a LOJA repassa ao sistema e ao entregador conforme a tabela do Admin
    let resolvedFee = 10.0;
    if (targetRegion) {
      resolvedFee = resolveRegionDeliveryFee({
        region: targetRegion,
        vehicleType: "moto",
        companySettings: company,
        pricingRules: pricingRules,
      });
    } else if (company.delivery_fee && Number(company.delivery_fee) > 0) {
      resolvedFee = Number(company.delivery_fee);
    }

    // Se o valor do frete da tabela do Admin foi identificado (> 0), dispara a entrega direto com o valor oficial!
    if (resolvedFee > 0) {
      await executeDispatch(order, resolvedFee, resolvedRegionId);
    } else {
      // Fallback: abre modal pre-preenchido
      setSelectedOrder(order);
      setDeliveryFee(resolvedFee > 0 ? resolvedFee.toFixed(2).replace(".", ",") : "10,00");
      setSelectedRegionId(resolvedRegionId);
      setIsDispatchModalOpen(true);
    }
  };

  const executeDispatch = async (order: any, fee: number, regionId?: string) => {
    if (!company) return;
    const orderId = order.id;
    if (!acquireLock(orderId)) return;

    setBusyDispatch(true);

    try {
      // 1. Consulta o estado atual do pedido no banco
      const { data: checkData } = await supabase
        .from("orders")
        .select("id, status, delivery_id")
        .eq("id", orderId)
        .maybeSingle();

      const currentStatus = checkData?.status || order.status;
      const currentDeliveryId = checkData?.delivery_id || order.delivery_id;

      // Se o pedido já foi concluído ou cancelado
      if (currentStatus === "delivered" || currentStatus === "cancelled") {
        toast.warning("Este pedido já foi finalizado ou cancelado.");
        setBusyDispatch(false);
        setIsDispatchModalOpen(false);
        releaseLock(orderId);
        qc.invalidateQueries({ queryKey: ["orders"] });
        return;
      }

      // Se já possui uma entrega vinculada e o pedido já está em rota
      if (currentStatus === "in_route" && currentDeliveryId) {
        toast.info("O entregador já foi solicitado para este pedido!");
        setBusyDispatch(false);
        setIsDispatchModalOpen(false);
        releaseLock(orderId);
        qc.invalidateQueries({ queryKey: ["orders"] });
        return;
      }

      const customerName = order.customers?.name || order.customer_name || "Cliente";
      const customerPhone = order.customers?.phone || order.customer_phone || "";

      let deliveryRecordId = currentDeliveryId;

      // Se ainda não tiver entrega criada no banco, insere em deliveries
      if (!deliveryRecordId) {
        const { data: d, error: e1 } = await supabase.from("deliveries").insert({
          company_id: company.id,
          order_id: order.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          address: order.delivery_address || "Não informado",
          value: fee,
          region_id: regionId || null,
          status: "pending"
        }).select("id").single();

        if (e1) {
          toast.error("Erro ao registrar entrega: " + e1.message);
          setBusyDispatch(false);
          releaseLock(orderId);
          return;
        }
        deliveryRecordId = d.id;
      } else {
        // Se já tinha ID de entrega mas o pedido ainda não estava em rota, atualiza a entrega
        await supabase.from("deliveries").update({
          value: fee,
          region_id: regionId || null,
          status: "pending"
        }).eq("id", deliveryRecordId);
      }

      // Atualiza o pedido para "in_route" com o delivery_id
      const { error: updateErr } = await supabase
        .from("orders")
        .update({ status: "in_route", delivery_id: deliveryRecordId })
        .eq("id", order.id);

      if (updateErr) {
        console.error("[Orders] Erro ao atualizar status do pedido para in_route:", updateErr);
      }
      
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["pending-orders"] });
      toast.success(`Entregador solicitado com sucesso! Taxa da região: ${fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
      setIsDispatchModalOpen(false);
    } catch (err: any) {
      toast.error("Erro ao solicitar entregador: " + (err?.message || "Tente novamente"));
    } finally {
      setBusyDispatch(false);
      releaseLock(orderId);
    }
  };

  const confirmDispatch = async () => {
    if (!selectedOrder || !company) return;
    const fee = parseFloat(deliveryFee.replace(/\./g, "").replace(",", "."));
    if (isNaN(fee) || fee <= 0) {
      toast.error("Valor inválido");
      return;
    }
    await executeDispatch(selectedOrder, fee, selectedRegionId);
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
        <h1>MT 24horas express</h1>
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
              <strong>${i.quantity}x</strong> ${i.product_name || "Produto"} - ${brl(i.price * i.quantity)}
              ${i.notes ? `<br/><small style="color:#666">Obs: ${i.notes}</small>` : ""}
            </div>
          `).join('') || "Nenhum item encontrado."}
        </div>
        <hr/>
        <div class="label">Total do Pedido</div>
        <div class="value" style="font-size:16px">${brl(Number(order.total || 0))}</div>
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
          {pendingCount > 0 && (
             <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-warning/20 text-warning font-black text-xs uppercase tracking-widest animate-pulse border border-warning/30">
               <Clock className="h-4 w-4" />
               {pendingCount} {pendingCount === 1 ? 'Novo Pedido' : 'Novos Pedidos'}
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
                  <div className={cn("w-2 h-6 rounded-full", "bg-" + col.color, 
                    col.color === "warning" && "bg-warning", 
                    col.color === "success" && "bg-success", 
                    col.color === "primary" && "bg-primary")} />
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
                  const isProcessing = processingOrderIds.has(order.id);

                  return (
                    <div 
                      key={order.id} 
                      onClick={() => {
                        setDetailOrder(order);
                        setIsDetailModalOpen(true);
                      }}
                      className={cn(
                      "bg-card border border-border/60 rounded-[1.5rem] p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30 group relative overflow-hidden cursor-pointer",
                      isPending && "border-warning/40 bg-warning/[0.02]"
                    )}>
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
                        
                        <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                          {isPending && (
                            <button 
                              disabled={isProcessing}
                              onClick={() => cancelOrder(order.id)}
                              className="w-10 h-10 rounded-xl bg-destructive/5 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all shrink-0 disabled:opacity-50"
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
                              disabled={isProcessing}
                              onClick={() => {
                                if (order.status === "ready") {
                                  handleDispatchOrder(order);
                                } else {
                                  advance(order.id, order.status);
                                }
                              }}
                              className={cn("flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50",
                                isPending ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20' : 
                                'bg-foreground text-background hover:bg-foreground/90')}
                            >
                              {isProcessing ? "Aguarde..." : (
                                order.status === "pending" ? "Aceitar Pedido" : 
                                order.status === "preparing" ? "Marcar Pronto" : 
                                order.status === "ready" ? "Chamar Entregador" : "Concluir"
                              )}
                              {!isProcessing && order.status !== "ready" && <ArrowRight className="h-3 w-3" />}
                              {!isProcessing && order.status === "ready" && <Truck className="h-3 w-3" />}
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

      <Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0">
          <div className="bg-primary/5 p-8 pb-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center mb-6">
              <Truck className="h-8 w-8 text-primary" />
            </div>
            <DialogHeader className="text-left p-0">
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground">Chamar Entregador</DialogTitle>
              <DialogDescription className="text-muted-foreground font-bold text-sm leading-relaxed mt-2">
                Informe o valor que será pago ao entregador por esta entrega. Este valor será visível para os motoboys da região.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 pt-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Valor da Entrega (R$)</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                   <span className="font-black text-primary">R$</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={deliveryFee}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, '');
                    if(!v) v = '0';
                    const n = parseInt(v, 10) / 100;
                    setDeliveryFee(n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                  }}
                  placeholder="0,00"
                  className="w-full h-16 pl-16 pr-6 rounded-[1.25rem] bg-secondary/30 border-2 border-transparent focus:border-primary/20 focus:bg-white transition-all text-2xl font-black tracking-tighter outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Região da Entrega (Opcional)</label>
              <div className="text-xs text-muted-foreground mb-2 ml-1">
                Endereço: {selectedOrder?.delivery_address || "Não informado"}
              </div>
              <select
                value={selectedRegionId}
                onChange={(e) => {
                  const regId = e.target.value;
                  setSelectedRegionId(regId);
                  const regObj = regions.find((r: any) => r.id === regId);
                  if (regObj) {
                    const price = resolveRegionDeliveryFee({
                      region: regObj,
                      vehicleType: "moto",
                      companySettings: company,
                      pricingRules: pricingRules,
                    });
                    setDeliveryFee(price.toFixed(2).replace(".", ","));
                  }
                }}
                className="w-full h-14 px-4 rounded-[1.25rem] bg-secondary/30 border-2 border-transparent focus:border-primary/20 focus:bg-white transition-all text-sm font-bold tracking-tight outline-none appearance-none"
              >
                <option value="">Selecione uma região...</option>
                {regions.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsDispatchModalOpen(false)}
                className="flex-1 h-14 rounded-2xl bg-secondary text-foreground font-black text-xs uppercase tracking-widest hover:bg-secondary/80 transition-all border border-border"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDispatch}
                disabled={busyDispatch}
                className="flex-[2] h-14 rounded-2xl bg-foreground text-background font-black text-xs uppercase tracking-widest hover:bg-foreground/90 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busyDispatch ? "Solicitando..." : "Confirmar Solicitação"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal de Detalhes do Pedido */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onAdvance={async (orderId, nextStatus) => {
            if (nextStatus === "ready_dispatch" || (detailOrder.status === "ready" && nextStatus === "ready")) {
              setIsDetailModalOpen(false);
              handleDispatchOrder(detailOrder);
              return;
            }
            try {
              const { error } = await supabase
                .from("orders")
                .update({ status: nextStatus })
                .eq("id", orderId);
              if (error) {
                toast.error(`Erro ao atualizar pedido: ${error.message}`);
              } else {
                toast.success(`Pedido atualizado com sucesso!`);
                qc.invalidateQueries({ queryKey: ["orders"] });
                qc.invalidateQueries({ queryKey: ["pending-orders"] });
              }
            } catch (err: any) {
              toast.error("Erro ao atualizar status.");
            }
          }}
          onStatusUpdate={() => {
            qc.invalidateQueries({ queryKey: ["orders"] });
            qc.invalidateQueries({ queryKey: ["pending-orders"] });
          }}
        />
      )}
    </div>
  );
}
