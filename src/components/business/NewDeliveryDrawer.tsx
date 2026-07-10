import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PlusCircle, MapPin, Banknote, Car, Motorbike, Bike, PackageOpen, Info, Phone } from "lucide-react";

interface NewDeliveryDrawerProps {
  companyId: string | undefined;
  onDone: () => void;
}

export function NewDeliveryDrawer({ companyId, onDone }: NewDeliveryDrawerProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  
  const [f, setF] = useState({
    customer_name: "",
    customer_phone: "",
    address: "",
    customer_address_number: "",
    customer_neighborhood: "",
    customer_address_complement: "",
    payment_method: "dinheiro",
    order_value: "",
    change_for: "",
    vehicle_type: "moto",
    value: "", // Delivery fee (frete)
    notes: ""
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    
    // Concat address if needed or just send structured
    const fullAddress = `${f.address}, ${f.customer_address_number} - ${f.customer_neighborhood} ${f.customer_address_complement ? `(${f.customer_address_complement})` : ""}`;
    
    setBusy(true);
    const { error } = await supabase.from("deliveries").insert({
      company_id: companyId,
      customer_name: f.customer_name,
      customer_phone: f.customer_phone,
      address: fullAddress,
      customer_address_number: f.customer_address_number,
      customer_neighborhood: f.customer_neighborhood,
      customer_address_complement: f.customer_address_complement,
      payment_method: f.payment_method,
      order_value: Number(f.order_value || 0),
      change_for: Number(f.change_for || 0),
      vehicle_type: f.vehicle_type,
      value: Number(f.value || 0),
      notes: f.notes,
      status: "pending",
    });
    setBusy(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Corrida solicitada com sucesso!");
      setOpen(false);
      onDone();
      // Reset
      setF({
        customer_name: "", customer_phone: "", address: "", customer_address_number: "",
        customer_neighborhood: "", customer_address_complement: "", payment_method: "dinheiro",
        order_value: "", change_for: "", vehicle_type: "moto", value: "", notes: ""
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="lg" className="rounded-xl h-12 px-7 font-black shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <PlusCircle className="h-5 w-5" />
          Nova Solicitação
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-card border-l border-border/40 p-0 sm:rounded-l-[2rem]">
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border/40 px-6 py-5">
          <SheetHeader>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Sistema de Despacho</p>
            <SheetTitle className="text-2xl font-black tracking-tight">Nova Solicitação de Entrega</SheetTitle>
          </SheetHeader>
        </div>
        
        <form onSubmit={submit} className="p-6 space-y-8">
          
          {/* Seção: Cliente */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">1</span>
              Dados do Cliente
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome do cliente</Label>
                <Input value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} required className="rounded-xl h-11 bg-secondary/30" placeholder="Ex: João da Silva" />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} className="rounded-xl h-11 pl-9 bg-secondary/30" placeholder="(00) 00000-0000" />
                </div>
              </div>
            </div>
          </section>

          {/* Seção: Endereço */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">2</span>
              Endereço de Destino
            </h3>
            <div className="space-y-4 p-5 rounded-[1.5rem] bg-secondary/20 border border-border/40">
              <div className="grid sm:grid-cols-[2fr_1fr] gap-4">
                <div className="space-y-1.5">
                  <Label>Rua / Avenida</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required className="rounded-xl h-11 pl-9 bg-background" placeholder="Ex: Av. Brasil" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Número</Label>
                  <Input value={f.customer_address_number} onChange={(e) => setF({ ...f, customer_address_number: e.target.value })} required className="rounded-xl h-11 bg-background" placeholder="Ex: 123" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Bairro</Label>
                  <Input value={f.customer_neighborhood} onChange={(e) => setF({ ...f, customer_neighborhood: e.target.value })} required className="rounded-xl h-11 bg-background" placeholder="Ex: Centro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Complemento (Opcional)</Label>
                  <Input value={f.customer_address_complement} onChange={(e) => setF({ ...f, customer_address_complement: e.target.value })} className="rounded-xl h-11 bg-background" placeholder="Apto, Bloco, Casa..." />
                </div>
              </div>
            </div>
          </section>

          {/* Seção: Detalhes da Corrida */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">3</span>
              Detalhes do Transporte
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Veículo Necessário</Label>
                <Select value={f.vehicle_type} onValueChange={(v) => setF({ ...f, vehicle_type: v })}>
                  <SelectTrigger className="rounded-xl h-11 bg-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="moto"><div className="flex items-center gap-2"><Motorbike className="h-4 w-4" /> Moto (Padrão)</div></SelectItem>
                    <SelectItem value="carro"><div className="flex items-center gap-2"><Car className="h-4 w-4" /> Carro (Itens Maiores)</div></SelectItem>
                    <SelectItem value="carro_aberto"><div className="flex items-center gap-2"><Car className="h-4 w-4" /> Carro Aberto (Frete)</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Taxa do Entregador (Frete R$)</Label>
                <Input type="number" step="0.01" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} required className="rounded-xl h-11 bg-secondary/30 font-black text-primary" placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações para o Entregador (Opcional)</Label>
              <div className="relative">
                <Info className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <textarea 
                  value={f.notes} 
                  onChange={(e) => setF({ ...f, notes: e.target.value })} 
                  className="w-full rounded-xl border border-input bg-secondary/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] pl-9 resize-none" 
                  placeholder="Instruções de cuidado, como chegar, etc."
                />
              </div>
            </div>
          </section>

          {/* Seção: Acerto Financeiro */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-foreground/80">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">4</span>
              Acerto com Cliente (Cobrança)
            </h3>
            <div className="space-y-4 p-5 rounded-[1.5rem] bg-emerald-500/5 border border-emerald-500/20">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-emerald-700 dark:text-emerald-400">Forma de Pagamento</Label>
                  <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
                    <SelectTrigger className="rounded-xl h-11 bg-background border-emerald-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão (Maquininha)</SelectItem>
                      <SelectItem value="pix">PIX (Chave do Entregador)</SelectItem>
                      <SelectItem value="pago">Já pago online (Não cobrar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {f.payment_method !== "pago" && (
                  <div className="space-y-1.5">
                    <Label className="text-emerald-700 dark:text-emerald-400">Valor a Cobrar do Cliente (R$)</Label>
                    <div className="relative">
                      <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                      <Input type="number" step="0.01" value={f.order_value} onChange={(e) => setF({ ...f, order_value: e.target.value })} required className="rounded-xl h-11 pl-9 bg-background border-emerald-500/30 font-bold" placeholder="0.00" />
                    </div>
                  </div>
                )}
              </div>
              
              {f.payment_method === "dinheiro" && (
                <div className="space-y-1.5 pt-2">
                  <Label className="text-emerald-700 dark:text-emerald-400">Troco para (R$) - Deixe 0 se não precisar</Label>
                  <Input type="number" step="0.01" value={f.change_for} onChange={(e) => setF({ ...f, change_for: e.target.value })} className="rounded-xl h-11 bg-background border-emerald-500/30" placeholder="0.00" />
                </div>
              )}
            </div>
          </section>

          {/* Submit */}
          <div className="pt-4 pb-12">
            <Button type="submit" disabled={busy} className="w-full rounded-2xl h-14 text-base font-black shadow-glow">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar Solicitação de Entrega"}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 font-medium">
              O entregador receberá R$ {Number(f.value || 0).toFixed(2)} por esta corrida.
            </p>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
