import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wallet, AlertTriangle, ArrowUpRight, ArrowDownRight, Loader2, Package, TrendingDown, Plus, RotateCcw, Filter,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import {
  useCredits, useCreditTransactions, useCreditPurchaseRequests, useRequestTopup,
} from "@/services/credits";

const TYPE_LABEL: Record<string, string> = {
  topup: "Recarga de saldo",
  debit: "Taxa de entrega",
  refund: "Estorno de cancelamento",
  adjustment: "Ajuste manual",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando admin",
  approved: "Aprovado",
  rejected: "Recusado",
};

export function CreditsPanel() {
  const credits = useCredits();
  const txs = useCreditTransactions();
  const requests = useCreditPurchaseRequests();
  const requestTopup = useRequestTopup();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("300");
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(0);
  const [tabFilter, setTabFilter] = useState<"all" | "refund" | "topup" | "debit">("all");
  const PAGE_SIZE = 12;

  const rawList = txs.data ?? [];

  const list = useMemo(() => {
    if (tabFilter === "all") return rawList;
    if (tabFilter === "refund") {
      return rawList.filter(
        (t) => t.type === "refund" || t.description?.toLowerCase().includes("estorno") || t.description?.toLowerCase().includes("cancelad")
      );
    }
    if (tabFilter === "topup") {
      return rawList.filter((t) => t.type === "topup" || (t.amount > 0 && t.type !== "refund" && !t.description?.toLowerCase().includes("estorno")));
    }
    if (tabFilter === "debit") {
      return rawList.filter((t) => t.type === "debit" || t.amount < 0);
    }
    return rawList;
  }, [rawList, tabFilter]);

  const metrics = useMemo(() => {
    const topups = list.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const debits = list.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const deliveries = list.filter((t) => t.type === "debit").length;
    const avg = deliveries ? debits / deliveries : 0;
    const remaining = avg > 0 ? Math.floor(credits.balance / avg) : null;
    return { topups, debits, deliveries, avg, remaining };
  }, [list, credits.balance]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    list.filter((t) => t.amount < 0).forEach((t) => {
      const d = new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      map.set(d, (map.get(d) ?? 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries()).reverse().slice(-30).map(([day, total]) => ({ day, total }));
  }, [list]);

  const pageItems = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pending = (requests.data ?? []).filter((r: any) => r.status === "pending");

  const submit = async () => {
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) {
      toast.error("Informe um valor válido para a recarga.");
      return;
    }
    try {
      await requestTopup.mutateAsync({ amount: value, notes });
      toast.success("Pedido de recarga enviado ao administrador!");
      setOpen(false);
      setNotes("");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar o pedido.");
    }
  };

  if (credits.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (credits.isError) {
    return (
      <div className="bg-card border border-destructive/40 rounded-2xl p-8 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
        <p className="font-bold">Não foi possível carregar seus créditos.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => credits.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {credits.isLow && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-black text-sm">Saldo baixo de créditos</p>
            <p className="text-xs text-muted-foreground font-medium">
              Você tem {brl(credits.balance)} disponíveis. Solicite uma recarga para não interromper suas entregas.
            </p>
          </div>
        </div>
      )}

      {/* Saldo */}
      <div className="grid gap-4 md:grid-cols-4">
        <div
          className={`md:col-span-2 rounded-2xl p-6 border ${
            credits.isLow ? "border-destructive/50 bg-destructive/5" : "border-primary/40 bg-primary/5"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet className={`h-4.5 w-4.5 ${credits.isLow ? "text-destructive" : "text-primary"}`} />
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Saldo de créditos
            </p>
          </div>
          <p className={`text-4xl font-black tracking-tight ${credits.isLow ? "text-destructive" : "text-foreground"}`}>
            {brl(credits.balance)}
          </p>
          <p className="text-[11px] text-muted-foreground font-medium mt-2">
            {metrics.remaining !== null
              ? `Aproximadamente ${metrics.remaining} entrega(s) com o custo médio atual`
              : "Créditos são debitados automaticamente a cada entrega solicitada"}
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="mt-4 rounded-xl font-bold">
                <Plus className="h-4 w-4 mr-1" /> Solicitar recarga
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Solicitar recarga de créditos</DialogTitle>
                <DialogDescription>
                  O administrador recebe seu pedido e adiciona os créditos ao seu painel após a confirmação do pagamento.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-bold">Valor (R$)</Label>
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="rounded-xl mt-1"
                  />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {[100, 200, 300, 500, 1000].map((v) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs font-bold"
                        onClick={() => setAmount(String(v))}
                      >
                        {brl(v)}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold">Observações (opcional)</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={requestTopup.isPending} className="rounded-xl font-bold">
                  {requestTopup.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Enviar pedido
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <StatCard icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />} label="Total recarregado" value={brl(metrics.topups)} />
        <StatCard icon={<ArrowDownRight className="h-4 w-4 text-destructive" />} label="Total consumido" value={brl(metrics.debits)} />
        <StatCard icon={<Package className="h-4 w-4 text-primary" />} label="Entregas pagas com créditos" value={String(metrics.deliveries)} />
        <StatCard icon={<TrendingDown className="h-4 w-4 text-primary" />} label="Custo médio por entrega" value={brl(metrics.avg)} />
      </div>

      {pending.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Pedidos de recarga
          </p>
          <div className="space-y-2">
            {pending.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span className="font-bold">{brl(Number(r.amount))}</span>
                <span className="text-xs text-muted-foreground font-medium">
                  {STATUS_LABEL[r.status] ?? r.status} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consumo diário */}
      <div className="bg-card border border-border/60 rounded-2xl p-6">
        <h3 className="text-base font-black text-foreground mb-4">Consumo diário de créditos</h3>
        {chartData.length === 0 ? (
          <EmptyState text="Nenhum consumo de créditos registrado ainda." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => brl(Number(v))} />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Extrato */}
      <div className="bg-card border border-border/60 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-base font-black text-foreground">Extrato de créditos</h3>
            <p className="text-xs text-muted-foreground font-medium">Controle detalhado de recargas, consumos e estornos de entregas canceladas</p>
          </div>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl overflow-x-auto">
            <button
              onClick={() => { setTabFilter("all"); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tabFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todas ({rawList.length})
            </button>
            <button
              onClick={() => { setTabFilter("refund"); setPage(0); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tabFilter === "refund"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              <RotateCcw className="h-3 w-3" />
              Estornos ({rawList.filter(t => t.type === 'refund' || t.description?.toLowerCase().includes('estorno') || t.description?.toLowerCase().includes('cancelad')).length})
            </button>
            <button
              onClick={() => { setTabFilter("topup"); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tabFilter === "topup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Recargas ({rawList.filter(t => t.type === 'topup' || (t.amount > 0 && t.type !== 'refund')).length})
            </button>
            <button
              onClick={() => { setTabFilter("debit"); setPage(0); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tabFilter === "debit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Entregas ({rawList.filter(t => t.type === 'debit' || t.amount < 0).length})
            </button>
          </div>
        </div>

        {txs.isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState text={tabFilter === "refund" ? "Nenhum estorno registrado no período." : "Nenhuma movimentação de créditos até agora."} />
        ) : (
          <>
            <div className="divide-y divide-border/50">
              {pageItems.map((t) => {
                const isRefund = t.type === "refund" || t.description?.toLowerCase().includes("estorno");
                const isDebit = t.amount < 0;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isRefund ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                        isDebit ? "bg-destructive/10 text-destructive" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {isRefund ? <RotateCcw className="h-4 w-4" /> :
                         isDebit ? <ArrowDownRight className="h-4 w-4" /> :
                         <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground">
                            {TYPE_LABEL[t.type] ?? (isRefund ? "Estorno de cancelamento" : t.type)}
                          </p>
                          {isRefund && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <RotateCcw className="h-2.5 w-2.5" /> Devolvido
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                          {t.description || "Movimentação de saldo"}
                        </p>
                        <p className="text-[11px] text-muted-foreground/80 font-medium mt-0.5">
                          {new Date(t.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-black tabular-nums ${
                        isRefund ? "text-emerald-600 dark:text-emerald-400" :
                        isDebit ? "text-destructive" :
                        "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {isDebit ? "-" : "+"} {brl(Math.abs(t.amount))}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Saldo: {brl(t.balance_after)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {list.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" className="rounded-xl" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground font-bold">
                  Página {page + 1} de {Math.ceil(list.length / PAGE_SIZE)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={(page + 1) * PAGE_SIZE >= list.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-10 text-muted-foreground">
      <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
}
