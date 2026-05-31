import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { brl } from "@/lib/format";
import { Plus, Pencil, Trash2, Pause, Play, ImagePlus, ChevronLeft, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/business/products")({
  component: ProductsPage,
});

const CATEGORIES = [
  { v: "lanches", l: "🍔 Lanches" },
  { v: "pizzas", l: "🍕 Pizzas" },
  { v: "doces", l: "🍫 Doces" },
  { v: "bebidas", l: "🥤 Bebidas" },
  { v: "outros", l: "🏷️ Outros" },
];

function ProductsPage() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      return [];
    },
  });

  const toggleActive = async (p: any) => {};
  const remove = async (id: string) => {};

  if (creating || editing) {
    return <ProductForm companyId={company?.id} initial={editing} onClose={() => { setCreating(false); setEditing(null); qc.invalidateQueries({queryKey:["products"]}); }}/>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="label-tiny">Cardápio</p>
          <h1 className="text-3xl font-black tracking-tight">Produtos</h1>
        </div>
        <Button onClick={() => setCreating(true)} className="rounded-2xl h-12 px-6 font-bold"><Plus className="h-4 w-4 mr-2"/>Novo Produto</Button>
      </div>

      {products.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
          <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground/40"/>
          <p className="mt-3 text-muted-foreground">Adicione seu primeiro produto ao cardápio.</p>
          <Button onClick={() => setCreating(true)} className="mt-4 rounded-xl">Criar produto</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p: any) => {
            const img = Array.isArray(p.image_url) ? p.image_url[0] : null;
            return (
              <div key={p.id} className="bg-card border border-border rounded-[2rem] overflow-hidden hover:shadow-card transition group">
                <div className="aspect-[4/3] bg-secondary relative">
                  {img ? <img src={img} alt={p.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-muted-foreground/40"><UtensilsCrossed className="h-10 w-10"/></div>}
                  {!p.is_active && <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-warning text-warning-foreground text-[10px] font-black uppercase tracking-widest">Pausado</span>}
                </div>
                <div className="p-4">
                  <h3 className="font-black truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-black text-primary text-lg">{brl(p.price)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl flex-1" onClick={() => setEditing(p)}><Pencil className="h-3 w-3"/></Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => toggleActive(p)}>{p.is_active ? <Pause className="h-3 w-3"/> : <Play className="h-3 w-3"/>}</Button>
                    <Button size="sm" variant="outline" className="rounded-xl text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-3 w-3"/></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductForm({ companyId, initial, onClose }: any) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    category: initial?.category ?? "lanches",
    price: initial?.price ?? "",
    images: Array.isArray(initial?.image_url) ? initial.image_url : [],
  });
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (!companyId) return;
    const ext = file.name.split(".").pop();
    const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
    setF((s: any) => ({ ...s, images: [...s.images, data.publicUrl].slice(0, 3) }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-6">
      <button onClick={onClose} className="flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4"/>Voltar ao cardápio</button>
      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={save} className="bg-card border border-border rounded-[2rem] p-6 space-y-4">
          <h2 className="font-black text-xl">{initial ? "Editar produto" : "Novo produto"}</h2>
          <div><Label>Nome</Label><Input required value={f.name} onChange={(e)=>setF({...f,name:e.target.value})} className="rounded-xl h-11"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Categoria</Label>
              <Select value={f.category} onValueChange={(v)=>setF({...f,category:v})}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue/></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Preço (R$)</Label><Input type="number" step="0.01" required value={f.price} onChange={(e)=>setF({...f,price:e.target.value})} className="rounded-xl h-11"/></div>
          </div>
          <div><Label>Descrição</Label><Textarea value={f.description} onChange={(e)=>setF({...f,description:e.target.value})} className="rounded-xl"/></div>
          <Button type="submit" disabled={busy} className="rounded-xl h-11 px-6 font-bold w-full">{initial ? "Salvar alterações" : "Criar produto"}</Button>
        </form>

        <div className="bg-card border border-border rounded-[2rem] p-6">
          <h3 className="font-black text-sm mb-3">Fotos do produto</h3>
          <div className="grid grid-cols-3 gap-2">
            {f.images.map((url: string, i: number) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-secondary relative group">
                <img src={url} alt="" className="w-full h-full object-cover"/>
                <button onClick={()=>setF({...f,images:f.images.filter((_:string,j:number)=>j!==i)})} className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100">×</button>
              </div>
            ))}
            {f.images.length < 3 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary text-muted-foreground hover:text-primary">
                <ImagePlus className="h-6 w-6"/>
                <input type="file" accept="image/*" className="hidden" onChange={(e)=>e.target.files?.[0] && upload(e.target.files[0])}/>
              </label>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Até 3 fotos. JPG/PNG até 5MB.</p>
        </div>
      </div>
    </div>
  );
}
