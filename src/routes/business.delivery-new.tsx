import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyCompany } from "@/services/companies";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, MapPin, Banknote, Car, Motorbike, Info, Phone } from "lucide-react";

export const Route = createFileRoute("/business/delivery-new")({
  component: NewDeliveryPage,
});

function NewDeliveryPage() {
  const { user } = useAuth();
  const { data: company } = useMyCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  
  const [f, setF] = useState({
    customer_name: "",
    customer_phone: "",
    address: "",
    customer_address_number: "",
    customer_neighborhood: "",
    customer_address_complement: "",
    payment_method: "dinheiro",
    is_paid: false,
    order_value: "",
    change_for: "",
    vehicle_type: "moto",
    region_id: "none",
    value: "", // Delivery fee (frete)
    notes: ""
  });

  const { data: regions } = useQuery({
    queryKey: ["regions", company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data } = await supabase.from("regions").select("*").eq("company_id", company.id);
      return data || [];
    },
    enabled: !!company?.id
  });

  const handleRegionChange = (val: string) => {
    const region = regions?.find((r: any) => r.id === val);
    setF({
      ...f,
      region_id: val,
      value: region ? Number(region.fee).toFixed(2) : f.value,
      customer_neighborhood: region ? region.name : f.customer_neighborhood
    });
  };

  const handleMoneyChange = (field: "value" | "order_value" | "change_for", val: string) => {
    // Apenas números
    const numeric = val.replace(/\D/g, "");
    if (!numeric) {
      setF({ ...f, [field]: "" });
      return;
    }
    // Divide por 100 para ter os centavos corretos
    const formatted = (Number(numeric) / 100).toFixed(2);
    setF({ ...f, [field]: formatted });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    
    const fullAddress = `${f.address}, ${f.customer_address_number} - ${f.customer_neighborhood} ${f.customer_address_complement ? `(${f.customer_address_complement})` : ""}`;
    const shortId = "#" + Math.random().toString(36).substring(2, 6).toUpperCase();
    
    setBusy(true);
    const { error } = await supabase.from("deliveries").insert({
      company_id: company.id,
      short_id: shortId,
      customer_name: f.customer_name,
      customer_phone: f.customer_phone,
      address: fullAddress,
      customer_address_number: f.customer_address_number,
      customer_neighborhood: f.customer_neighborhood,
      customer_address_complement: f.customer_address_complement,
      payment_method: f.is_paid ? "pago" : f.payment_method,
      order_value: f.is_paid ? 0 : Number(f.order_value || 0),
      change_for: f.is_paid ? 0 : Number(f.change_for || 0),
      vehicle_type: f.vehicle_type,
      region_id: f.region_id === "none" ? null : f.region_id,
      value: Number(f.value || 0),
      notes: f.notes,
      status: "pending",
    });
    setBusy(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Corrida solicitada com sucesso!");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      navigate({ to: "/business" });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/business" })} className="rounded-xl h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">Sistema de Despacho</p>
            <h1 className="text-xl font-black tracking-tight">Nova Solicitação de Entrega</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        <form onSubmit={submit} className="space-y-8 bg-card border border-border/40 p-6 sm:p-8 rounded-[2rem] shadow-sm">
          
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
                  <Label>Região / Bairro</Label>
                  <Select value={f.region_id} onValueChange={handleRegionChange}>
                    <SelectTrigger className="rounded-xl h-11 bg-background">
                      <SelectValue placeholder="Selecione ou digite" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="none">Outro Bairro (Digitar)</SelectItem>
                      {regions?.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name} - R$ {Number(r.fee).toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {f.region_id === "none" && (
                    <Input value={f.customer_neighborhood} onChange={(e) => setF({ ...f, customer_neighborhood: e.target.value })} required className="rounded-xl h-11 mt-2 bg-background" placeholder="Ex: Centro" />
                  )}
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
                <Input 
                  type="text" 
                  inputMode="numeric"
                  value={f.value} 
                  onChange={(e) => handleMoneyChange("value", e.target.value)} 
                  required 
                  className="rounded-xl h-11 bg-secondary/30 font-black text-primary" 
                  placeholder="0.00" 
                />
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
              
              <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-emerald-500/20">
                <div className="space-y-0.5">
                  <Label className="text-base text-emerald-800 dark:text-emerald-400">Pedido já foi pago?</Label>
                  <p className="text-xs text-muted-foreground">O entregador não precisará cobrar nada do cliente.</p>
                </div>
                <Switch checked={f.is_paid} onCheckedChange={(c) => setF({ ...f, is_paid: c })} />
              </div>

              {!f.is_paid && (
                <>
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
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-emerald-700 dark:text-emerald-400">Valor a Cobrar do Cliente (R$)</Label>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                        <Input 
                          type="text"
                          inputMode="numeric"
                          value={f.order_value} 
                          onChange={(e) => handleMoneyChange("order_value", e.target.value)} 
                          required 
                          className="rounded-xl h-11 pl-9 bg-background border-emerald-500/30 font-bold" 
                          placeholder="0.00" 
                        />
                      </div>
                    </div>
                  </div>
                  
                  {f.payment_method === "dinheiro" && (
                    <div className="space-y-1.5 pt-2">
                      <Label className="text-emerald-700 dark:text-emerald-400">Troco para (R$) - Deixe 0 se não precisar</Label>
                      <Input 
                        type="text"
                        inputMode="numeric"
                        value={f.change_for} 
                        onChange={(e) => handleMoneyChange("change_for", e.target.value)} 
                        className="rounded-xl h-11 bg-background border-emerald-500/30" 
                        placeholder="0.00" 
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Submit */}
          <div className="pt-4">
            <Button type="submit" disabled={busy} className="w-full rounded-2xl h-14 text-base font-black shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar Solicitação de Entrega"}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 font-medium">
              O entregador receberá R$ {Number(f.value || 0).toFixed(2)} por esta corrida.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
