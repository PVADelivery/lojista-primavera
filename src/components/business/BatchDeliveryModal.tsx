import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCredits } from "@/services/credits";
import { useMyCompany } from "@/services/companies";
import { RegionZoneSelector } from "@/components/business/RegionZoneSelector";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, DollarSign } from "lucide-react";

export interface BatchItem {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  region_id: string;
  region_name: string;
  value: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BatchDeliveryModal({ open, onOpenChange, onSuccess }: Props) {
  const qc = useQueryClient();
  const { data: company } = useMyCompany();
  const { balance: creditBalance } = useCredits();
  const [submitting, setSubmitting] = useState(false);

  // Inicialmente 3 formulários independentes de entrega
  const createEmptyItem = (index: number): BatchItem => ({
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
    customer_name: "",
    customer_phone: "",
    address: "",
    region_id: "none",
    region_name: "",
    value: "0.00",
  });

  const [items, setItems] = useState<BatchItem[]>(() => [
    createEmptyItem(1),
    createEmptyItem(2),
    createEmptyItem(3),
  ]);

  // Adicionar nova entrega ao lote
  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem(prev.length + 1)]);
  };

  // Remover entrega do lote
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.warning("O lote deve possuir pelo menos 1 entrega.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Atualizar campo específico de um item
  const updateItem = (id: string, field: keyof BatchItem, val: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  // Seleção de região por item
  const handleRegionSelectForItem = (
    id: string,
    fee: number,
    regionId: string,
    regionName: string
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              region_id: regionId,
              region_name: regionName,
              value: fee.toFixed(2),
            }
          : item
      )
    );
  };

  // Total do lote
  const totalValue = useMemo(() => {
    return items.reduce((acc, item) => acc + (parseFloat(item.value) || 0), 0);
  }, [items]);

  const insufficientCredits = totalValue > 0 && creditBalance < totalValue;

  // Submeter batch para a RPC do Supabase
  const handleSubmitBatch = async () => {
    if (!company?.id) {
      toast.error("Empresa não encontrada.");
      return;
    }

    // Validações individuais
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const num = i + 1;
      if (!item.customer_name.trim()) {
        toast.error(`Entrega ${num}: Digite o nome do cliente.`);
        return;
      }
      if (!item.address.trim()) {
        toast.error(`Entrega ${num}: Digite o endereço de entrega.`);
        return;
      }
      if (!item.region_id || item.region_id === "none") {
        toast.error(`Entrega ${num}: Selecione uma região de entrega.`);
        return;
      }
      const val = parseFloat(item.value);
      if (isNaN(val) || val <= 0) {
        toast.error(`Entrega ${num}: Taxa de entrega inválida.`);
        return;
      }
    }

    if (insufficientCredits) {
      toast.error(`Saldo insuficiente. Necessário: ${brl(totalValue)}, Saldo: ${brl(creditBalance)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = items.map((item) => ({
        customer_name: item.customer_name.trim(),
        customer_phone: item.customer_phone.trim(),
        address: item.address.trim(),
        region_id: item.region_id,
        value: parseFloat(item.value),
      }));

      const { data, error } = await supabase.rpc("batch_create_delivery_requests", {
        p_company_id: company.id,
        p_deliveries: payload,
      });

      if (error) {
        throw new Error(error.message || "Falha ao criar entregas em lote.");
      }

      if (data && (data as any).success) {
        const createdCount = (data as any).deliveries?.length || items.length;
        const shortIds = ((data as any).deliveries || [])
          .map((d: any) => d.short_id)
          .join(", ");

        toast.success(`🎉 ${createdCount} entregas criadas com sucesso! (${shortIds})`);

        // Invalidar queries para atualizar interface imediatamente
        qc.invalidateQueries({ queryKey: ["deliveries"] });
        qc.invalidateQueries({ queryKey: ["credits"] });
        qc.invalidateQueries({ queryKey: ["credit-transactions"] });

        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error((data as any)?.error || "Erro desconhecido ao processar lote.");
      }
    } catch (err: any) {
      console.error("[BatchDeliveryModal] Erro:", err);
      toast.error(err.message || "Erro ao criar lote de entregas.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-primary">
            <Package className="h-6 w-6" /> ENTREGAS EM LOTE (Criar Várias Solicitações)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Preencha cada entrega individualmente. Elas serão salvas como registros independentes no banco e notificadas separadamente ao entregador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contador de entregas */}
          <div className="flex items-center justify-between bg-muted/40 p-4 rounded-2xl border border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Quantidade de entregas no lote</Label>
              <p className="text-xs text-muted-foreground">Cada uma terá id, short_id e débito financeiro próprio.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-primary px-3 py-1 bg-primary/10 rounded-xl">
                {items.length} entregas
              </span>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="rounded-xl">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Formulários individuais das entregas */}
          <div className="space-y-6">
            {items.map((item, idx) => {
              const num = idx + 1;
              return (
                <div
                  key={item.id}
                  className="bg-card border-2 border-border/80 rounded-3xl p-5 shadow-sm space-y-4 relative hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-xs">
                        {num}
                      </span>
                      <h4 className="font-bold text-base text-foreground">Entrega {num}</h4>
                      {parseFloat(item.value) > 0 && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                          {brl(parseFloat(item.value))}
                        </span>
                      )}
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-destructive hover:bg-destructive/10 rounded-xl h-8 text-xs"
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Remover entrega
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Nome do Cliente <span className="text-destructive">*</span></Label>
                      <Input
                        value={item.customer_name}
                        onChange={(e) => updateItem(item.id, "customer_name", e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">WhatsApp / Telefone</Label>
                      <Input
                        value={item.customer_phone}
                        onChange={(e) => updateItem(item.id, "customer_phone", e.target.value)}
                        placeholder="(66) 99999-9999"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Endereço de Entrega <span className="text-destructive">*</span></Label>
                    <Input
                      value={item.address}
                      onChange={(e) => updateItem(item.id, "address", e.target.value)}
                      placeholder="Rua, número, bairro..."
                      className="rounded-xl"
                    />
                  </div>

                  {/* Seletor de Região específico desta linha */}
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Região de Entrega <span className="text-destructive">*</span>
                    </Label>
                    <RegionZoneSelector
                      companyId={company?.id}
                      initialSelectedId={item.region_id}
                      onRegionSelect={(fee, regionId, regionName) =>
                        handleRegionSelectForItem(item.id, fee, regionId, regionName)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botão para adicionar mais entregas */}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddItem}
            className="w-full py-6 rounded-2xl border-dashed border-2 hover:bg-primary/5 hover:border-primary transition-all text-primary font-bold"
          >
            <Plus className="h-5 w-5 mr-2" /> + Adicionar mais uma entrega ao lote
          </Button>

          {/* Quadro Resumo Financeiro do Lote */}
          <div className="bg-primary/5 border-2 border-primary/20 rounded-3xl p-5 space-y-4">
            <h4 className="font-bold text-sm uppercase tracking-wider text-primary flex items-center gap-2">
              <DollarSign className="h-5 w-5" /> Resumo do Lote ({items.length} entregas)
            </h4>

            <div className="space-y-2 divide-y divide-border/60 text-xs">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between pt-2">
                  <span className="font-medium">
                    Entrega {idx + 1} {item.customer_name ? `(${item.customer_name})` : ""}
                  </span>
                  <span className="font-bold">{brl(parseFloat(item.value) || 0)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-primary/30 pt-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-bold block">Valor Total do Lote</span>
                <span className="text-2xl font-black text-primary">{brl(totalValue)}</span>
              </div>

              <div className="text-right">
                <span className="text-xs text-muted-foreground uppercase font-bold block">Seu Saldo Disponível</span>
                <span className={`text-base font-bold ${insufficientCredits ? "text-destructive" : "text-emerald-600"}`}>
                  {brl(creditBalance)}
                </span>
              </div>
            </div>

            {insufficientCredits && (
              <div className="flex items-center gap-2 text-destructive text-xs font-bold bg-destructive/10 p-3 rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Saldo insuficiente para criar este lote. Recarregue seus créditos para continuar.</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-xl w-full sm:w-auto"
          >
            CANCELAR
          </Button>
          <Button
            type="button"
            onClick={handleSubmitBatch}
            disabled={submitting || insufficientCredits || totalValue <= 0}
            className="rounded-xl font-bold px-6 h-12 w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando lote em transação única...
              </>
            ) : (
              `CRIAR ${items.length} ENTREGAS (${brl(totalValue)})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
