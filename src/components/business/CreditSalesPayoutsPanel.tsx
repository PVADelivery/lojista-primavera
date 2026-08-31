import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Coins, Clock, CheckCircle2, AlertCircle, FileText, 
  ExternalLink, Search, RefreshCw, Eye, ArrowUpRight, 
  Receipt, Building2, User, ChevronRight, ShieldCheck, Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CreditSalesPayoutsPanelProps {
  companyId: string;
}

export function CreditSalesPayoutsPanel({ companyId }: CreditSalesPayoutsPanelProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // 1. Buscar todos os pedidos do marketplace pagos com créditos
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select(`
          id, total, status, created_at, delivery_fee, 
          payment_method, payout_status, payout_id, payout_at,
          customers (name, phone)
        `)
        .eq("company_id", companyId)
        .eq("payment_method", "credits")
        .order("created_at", { ascending: false });

      if (!ordersErr && ordersData) {
        setOrders(ordersData);
      }

      // 2. Buscar lotes de repasses realizados para esta empresa
      try {
        const { data: payoutsData, error: payoutsErr } = await supabase
          .from("merchant_credit_payouts")
          .select("*")
          .eq("company_id", companyId)
          .order("paid_at", { ascending: false });

        if (!payoutsErr && payoutsData) {
          setPayouts(payoutsData);
        }
      } catch (err) {
        console.warn("[CreditSalesPayoutsPanel] Tabela merchant_credit_payouts ainda não criada no banco:", err);
      }
    } catch (e) {
      console.error("[CreditSalesPayoutsPanel] Erro ao carregar dados:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [companyId]);

  // Cálculos consolidados
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "cancelled");
    const totalCreditSales = validOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    
    // Pendentes de repasse: pedidos que não tem payout_status = 'paid'
    const pendingOrders = validOrders.filter((o) => o.payout_status !== "paid");
    const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    // Repassados / Pagos pelo Admin
    const paidOrders = validOrders.filter((o) => o.payout_status === "paid");
    const paidAmount = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    return {
      totalCreditSales,
      pendingAmount,
      paidAmount,
      totalCount: validOrders.length,
      pendingCount: pendingOrders.length,
      paidCount: paidOrders.length,
    };
  }, [orders]);

  // Filtro de pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      const isPaid = order.payout_status === "paid";
      if (filterStatus === "pending" && isPaid) return false;
      if (filterStatus === "paid" && !isPaid) return false;

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const shortId = order.id.slice(0, 8).toLowerCase();
        const custName = (order.customers?.name || "").toLowerCase();
        return shortId.includes(term) || custName.includes(term);
      }

      return true;
    });
  }, [orders, filterStatus, searchTerm]);

  const fmt = (val: number) => {
    return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Informativo */}
      <div className="bg-gradient-to-r from-amber-500/10 via-primary/10 to-transparent border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-sm">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              Vendas Pagas com Créditos do Sistema
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-black uppercase">
                Repasse Admin
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Quando clientes compram usando o saldo de créditos da plataforma, o valor total é repassado diretamente pela administração para sua chave Pix cadastrada.
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchData} 
          disabled={loading}
          className="rounded-xl font-bold gap-2 shrink-0 border-border/80 hover:bg-muted"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total em Créditos */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Coins className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Total Vendido em Créditos</span>
          </div>
          <p className="text-2xl font-black text-foreground tracking-tight">{fmt(metrics.totalCreditSales)}</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-2">
            {metrics.totalCount} {metrics.totalCount === 1 ? "pedido no marketplace" : "pedidos no marketplace"}
          </p>
        </div>

        {/* Aguardando Repasse */}
        <div className="bg-gradient-to-br from-amber-500/10 via-card to-card border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-[0.15em]">Aguardando Repasse Admin</span>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{fmt(metrics.pendingAmount)}</p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300 font-bold mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {metrics.pendingCount} {metrics.pendingCount === 1 ? "pedido pendente de transferência" : "pedidos pendentes de transferência"}
          </p>
        </div>

        {/* Repasses Recebidos */}
        <div className="bg-card border border-success/30 rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center text-success">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">Repasses Já Recebidos</span>
          </div>
          <p className="text-2xl font-black text-success tracking-tight">{fmt(metrics.paidAmount)}</p>
          <p className="text-[11px] text-muted-foreground font-medium mt-2">
            {metrics.paidCount} {metrics.paidCount === 1 ? "pedido liquidado pelo Admin" : "pedidos liquidados pelo Admin"}
          </p>
        </div>
      </div>

      {/* Seção Principal: Pedidos & Lotes de Repasse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Pedidos (2 Colunas) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-black text-foreground">Extrato de Pedidos em Créditos</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Acompanhe a situação de cada pedido</p>
              </div>

              {/* Filtros de Status */}
              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/40">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                    filterStatus === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Todos ({orders.length})
                </button>
                <button
                  onClick={() => setFilterStatus("pending")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                    filterStatus === "pending" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pendentes ({metrics.pendingCount})
                </button>
                <button
                  onClick={() => setFilterStatus("paid")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                    filterStatus === "paid" ? "bg-success text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Repassados ({metrics.paidCount})
                </button>
              </div>
            </div>

            {/* Input de Busca */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID do pedido (#0A6205) ou nome do cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl border-border/60 bg-muted/30 text-xs h-10"
              />
            </div>

            {/* Tabela / Lista de Pedidos */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs font-bold">Carregando pedidos...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/70 rounded-xl bg-muted/10">
                <Coins className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-bold text-foreground">Nenhum pedido encontrado</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                  {searchTerm ? "Nenhum resultado corresponde à sua busca." : "Nenhum pedido pago com créditos registrado no período."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredOrders.map((order) => {
                  const isPaid = order.payout_status === "paid";
                  const isCancelled = order.status === "cancelled";
                  
                  return (
                    <div 
                      key={order.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 px-3 -mx-3 rounded-xl transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                          isPaid ? "bg-success/10 text-success" : isCancelled ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
                        )}>
                          {isPaid ? <CheckCircle2 className="h-5 w-5" /> : isCancelled ? <AlertCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-foreground">
                              Pedido #{order.id.slice(0, 8).toUpperCase()}
                            </span>
                            <Badge 
                              variant="outline"
                              className={cn(
                                "text-[10px] font-black uppercase px-2 py-0.5",
                                isPaid 
                                  ? "bg-success/10 text-success border-success/30" 
                                  : isCancelled
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse"
                              )}
                            >
                              {isPaid ? "Repasse Efetuado" : isCancelled ? "Cancelado" : "Aguardando Repasse"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 font-medium">
                              <User className="h-3 w-3" />
                              {order.customers?.name || "Cliente Marketplace"}
                            </span>
                            <span>•</span>
                            <span>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
                        <span className="text-sm font-black text-foreground tracking-tight">
                          {fmt(order.total)}
                        </span>
                        {isPaid && order.payout_at && (
                          <span className="text-[10px] font-bold text-success flex items-center gap-1 mt-0.5">
                            Pago em {format(new Date(order.payout_at), "dd/MM/yy")}
                          </span>
                        )}
                        {!isPaid && !isCancelled && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                            A repassar pelo Admin
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Lotes de Repasses Recebidos do Admin (1 Coluna) */}
        <div className="space-y-4">
          <div className="bg-card border border-border/60 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Receipt className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-foreground">Histórico de Repasses</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Lotes de pagamentos recebidos</p>
              </div>
            </div>

            {payouts.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/60 rounded-xl bg-muted/10">
                <FileText className="h-6 w-6 text-muted-foreground/40 mb-1.5" />
                <p className="text-xs font-bold text-foreground">Nenhum lote de repasse</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Os comprovantes de transferências feitas pelo Admin aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout) => (
                  <div 
                    key={payout.id}
                    onClick={() => setSelectedPayout(payout)}
                    className="p-3.5 border border-border/60 rounded-xl hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-foreground">
                        {format(new Date(payout.paid_at || payout.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] font-black">
                        {fmt(payout.amount)}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>{payout.order_ids?.length || 1} pedidos liquidados</span>
                      <span className="text-primary font-bold flex items-center gap-1 text-[11px]">
                        Ver Detalhes
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>

                    {payout.notes && (
                      <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2 rounded-lg truncate">
                        "{payout.notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Repasse */}
      <Dialog open={!!selectedPayout} onOpenChange={(o) => !o && setSelectedPayout(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <ShieldCheck className="h-5 w-5 text-success" />
              Comprovante de Repasse
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detalhes da transferência realizada pela administração do MT 24 Horas Express.
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-muted/40 p-4 rounded-xl space-y-2.5 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Valor Transferido:</span>
                  <span className="text-base font-black text-success">{fmt(selectedPayout.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Data do Pagamento:</span>
                  <span className="font-bold text-foreground">
                    {format(new Date(selectedPayout.paid_at || selectedPayout.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {selectedPayout.pix_key && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-medium">Chave Pix de Destino:</span>
                    <span className="font-bold text-foreground font-mono bg-background px-2 py-0.5 rounded border border-border/40">
                      {selectedPayout.pix_key}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Pedidos Incluídos:</span>
                  <span className="font-bold text-foreground">
                    {selectedPayout.order_ids?.length || 1} pedidos
                  </span>
                </div>
              </div>

              {selectedPayout.notes && (
                <div className="space-y-1">
                  <span className="font-bold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                    Observações do Administrador:
                  </span>
                  <p className="p-3 bg-muted/30 border border-border/40 rounded-xl text-xs text-foreground">
                    {selectedPayout.notes}
                  </p>
                </div>
              )}

              {selectedPayout.receipt_url && (
                <div className="space-y-2 pt-1">
                  <span className="font-bold text-foreground text-[11px] uppercase tracking-wider text-muted-foreground">
                    Comprovante Anexo:
                  </span>
                  <a
                    href={selectedPayout.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-xl text-primary font-bold transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Visualizar Comprovante Oficial
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSelectedPayout(null)}
              className="rounded-xl font-bold w-full"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
