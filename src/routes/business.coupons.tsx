import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { Tag, Plus, Trash2, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/business/coupons")({
  component: CouponsPage,
});

function CouponsPage() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any|null>(null);

  const { data: coupons = [] } = useQuery({
    queryKey: ["coupons", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("coupons").select("*").eq("company_id", company!.id).order("created_at",{ascending:false});
      return data ?? [];
    },
  });

  const toggleActive = async (c: any) => {
    await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["coupons"] });
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir este cupom?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["coupons"] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-accent/20 to-primary/10 p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-accent text-accent-foreground flex items-center justify-center"><Tag className="h-7 w-7"/></div>
          <div>
            <h1 className="text-2xl font-black">Fidelize seus Clientes</h1>
            <p className="text-sm text-muted-foreground">Crie cupons de desconto irresistíveis.</p>
          </div>
        </div>
        <Button onClick={()=>setEditing({})} className="rounded-2xl h-12 px-6 font-bold"><Plus className="h-4 w-4 mr-2"/>Novo Cupom</Button>
      </div>

      {coupons.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
          <Tag className="h-12 w-12 mx-auto text-muted-foreground/40"/>
          <p className="mt-3 text-muted-foreground">Nenhum cupom criado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-[2rem] p-5 hover:shadow-card transition hover:-translate-y-0.5">
              <div className="flex items-start justify-between">
                <button onClick={()=>{navigator.clipboard.writeText(c.code); toast.success("Código copiado");}} className="font-mono font-black text-xl tracking-wider hover:text-primary">{c.code}</button>
                <Switch checked={c.active} onCheckedChange={()=>toggleActive(c)}/>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{c.description ?? "—"}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-black text-accent">{c.discount_type==="percentage" ? `${c.discount_value}%` : brl(c.discount_value)}</span>
                <span className="text-xs text-muted-foreground">de desconto</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className="px-2 py-1 rounded-full bg-secondary">Min {brl(c.min_order_value)}</span>
                <span className="px-2 py-1 rounded-full bg-secondary">{c.used_count}/{c.usage_limit ?? "∞"}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="rounded-xl flex-1" onClick={()=>setEditing(c)}><Settings className="h-3 w-3 mr-1"/>Configurar</Button>
                <Button size="sm" variant="outline" className="rounded-xl text-destructive" onClick={()=>remove(c.id)}><Trash2 className="h-3 w-3"/></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o)=>!o&&setEditing(null)}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar cupom" : "Novo cupom"}</DialogTitle></DialogHeader>
          {editing && <CouponForm initial={editing} companyId={company?.id} onDone={()=>{setEditing(null); qc.invalidateQueries({queryKey:["coupons"]});}}/>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CouponForm({ initial, companyId, onDone }: any) {
  const [f, setF] = useState({
    code: initial?.code ?? "",
    description: initial?.description ?? "",
    discount_type: initial?.discount_type ?? "percentage",
    discount_value: initial?.discount_value ?? 10,
    min_order_value: initial?.min_order_value ?? 0,
    usage_limit: initial?.usage_limit ?? "",
    expires_at: initial?.expires_at?.slice(0,16) ?? "",
    active: initial?.active ?? true,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      company_id: companyId,
      code: f.code.toUpperCase(),
      description: f.description,
      discount_type: f.discount_type as "percentage"|"fixed",
      discount_value: Number(f.discount_value),
      min_order_value: Number(f.min_order_value || 0),
      usage_limit: f.usage_limit ? Number(f.usage_limit) : null,
      expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
      active: f.active,
    };
    const { error } = initial?.id
      ? await supabase.from("coupons").update(payload).eq("id", initial.id)
      : await supabase.from("coupons").insert(payload);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Cupom salvo"); onDone(); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Código</Label><Input required value={f.code} onChange={(e)=>setF({...f,code:e.target.value.toUpperCase()})} className="rounded-xl h-11 font-mono uppercase tracking-wider"/></div>
      <div><Label>Descrição</Label><Input value={f.description} onChange={(e)=>setF({...f,description:e.target.value})} className="rounded-xl h-11"/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tipo</Label>
          <Select value={f.discount_type} onValueChange={(v)=>setF({...f,discount_type:v})}>
            <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="percentage">Porcentagem</SelectItem><SelectItem value="fixed">Valor fixo</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Valor</Label><Input type="number" required value={f.discount_value} onChange={(e)=>setF({...f,discount_value:Number(e.target.value)})} className="rounded-xl h-11"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Pedido mínimo</Label><Input type="number" step="0.01" value={f.min_order_value} onChange={(e)=>setF({...f,min_order_value:Number(e.target.value)})} className="rounded-xl h-11"/></div>
        <div><Label>Limite de uso</Label><Input type="number" value={f.usage_limit} onChange={(e)=>setF({...f,usage_limit:e.target.value as any})} className="rounded-xl h-11"/></div>
      </div>
      <div><Label>Validade</Label><Input type="datetime-local" value={f.expires_at} onChange={(e)=>setF({...f,expires_at:e.target.value})} className="rounded-xl h-11"/></div>
      <Button type="submit" disabled={busy} className="w-full rounded-xl h-11 font-bold">Salvar cupom</Button>
    </form>
  );
}
