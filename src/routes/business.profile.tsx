import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Camera, Save } from "lucide-react";
import { toast } from "sonner";
import logoIcon from "@/assets/logo-icon.png";


export const Route = createFileRoute("/business/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (company) setF({ ...company }); }, [company]);

  const upload = async (file: File, key: "logo_url"|"cover_url") => {
    if (!company?.id) return;
    const ext = file.name.split(".").pop();
    const path = `${company.id}/${key}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("store-assets").getPublicUrl(path);
    setF((s: any) => ({ ...s, [key]: data.publicUrl }));
  };

  const save = async () => {
    if (!company?.id) return;
    setBusy(true);
    const { error } = await supabase.from("companies").update({
      name: f.name, description: f.description, category: f.category, phone: f.phone,
      address: f.address, business_hours: f.business_hours, logo_url: f.logo_url, cover_url: f.cover_url,
      is_open: f.is_open,
    }).eq("id", company.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Perfil publicado!"); qc.invalidateQueries({ queryKey: ["my-company"] }); }
  };

  if (!company) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="label-tiny">Identidade Visual</p>
        <h1 className="text-3xl font-black tracking-tight">Editor de Perfil da Loja</h1>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-card border border-border rounded-[2rem] overflow-hidden">
            <div className="relative h-44 bg-gradient-to-br from-primary to-info group">
              {f.cover_url && <img src={f.cover_url} alt="" className="w-full h-full object-cover"/>}
              <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                <Camera className="h-8 w-8 text-white"/>
                <input type="file" accept="image/*" className="hidden" onChange={(e)=>e.target.files?.[0]&&upload(e.target.files[0],"cover_url")}/>
              </label>
            </div>
            <div className="px-6 pb-6 -mt-12 relative">
              <div className="relative inline-block group">
                <div className="h-24 w-24 rounded-3xl bg-card border-4 border-card overflow-hidden shadow-lg">
                  {f.logo_url ? <img src={f.logo_url} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full bg-black flex items-center justify-center"><img src={logoIcon} alt="" className="w-20 h-20 object-contain"/></div>}
                </div>
                <label className="absolute inset-0 rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer">
                  <Camera className="h-6 w-6 text-white"/>
                  <input type="file" accept="image/*" className="hidden" onChange={(e)=>e.target.files?.[0]&&upload(e.target.files[0],"logo_url")}/>
                </label>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div><Label>Nome da loja</Label><Input value={f.name??""} onChange={(e)=>setF({...f,name:e.target.value})} className="rounded-xl h-11"/></div>
                <div><Label>Categoria</Label><Input value={f.category??""} onChange={(e)=>setF({...f,category:e.target.value})} placeholder="Lanchonete, pizzaria..." className="rounded-xl h-11"/></div>
              </div>
              <div className="mt-3"><Label>Bio / Descrição</Label><Textarea value={f.description??""} onChange={(e)=>setF({...f,description:e.target.value})} className="rounded-xl"/></div>
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <div><Label>WhatsApp de Vendas</Label><Input value={f.phone??""} onChange={(e)=>setF({...f,phone:e.target.value})} className="rounded-xl h-11"/></div>
                <div><Label>Horário de Funcionamento</Label><Input value={f.business_hours??""} onChange={(e)=>setF({...f,business_hours:e.target.value})} placeholder="Seg-Sex 18h-23h" className="rounded-xl h-11"/></div>
              </div>
              <div className="mt-3"><Label>Endereço</Label><Input value={f.address??""} onChange={(e)=>setF({...f,address:e.target.value})} className="rounded-xl h-11"/></div>
              <div className="mt-4 flex items-center justify-between p-4 bg-secondary rounded-2xl">
                <div>
                  <p className="font-black text-sm">Status do Delivery</p>
                  <p className="text-xs text-muted-foreground">Receber novos pedidos no marketplace</p>
                </div>
                <Switch checked={!!f.is_open} onCheckedChange={(v)=>setF({...f,is_open:v})}/>
              </div>
              <Button onClick={save} disabled={busy} className="mt-4 w-full rounded-2xl h-12 font-bold"><Save className="h-4 w-4 mr-2"/>Publicar Perfil</Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-20">
            <p className="label-tiny mb-2 text-center">Pré-visualização</p>
            <div className="mx-auto max-w-[280px] aspect-[9/18] rounded-[3rem] border-8 border-foreground/90 bg-background overflow-hidden shadow-2xl">
              <div className="h-24 bg-gradient-to-br from-primary to-info relative">
                {f.cover_url && <img src={f.cover_url} alt="" className="w-full h-full object-cover"/>}
              </div>
              <div className="px-3 -mt-8 relative">
                <div className="h-14 w-14 rounded-2xl bg-card border-4 border-card overflow-hidden">
                  {f.logo_url ? <img src={f.logo_url} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full bg-black flex items-center justify-center"><img src={logoIcon} alt="" className="w-12 h-12 object-contain"/></div>}
                </div>
                <p className="mt-2 font-black text-sm truncate">{f.name ?? "Sua Loja"}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2">{f.description ?? "Bio aparece aqui"}</p>
                <div className="mt-2 flex gap-1 text-[9px]">
                  <span className={`px-2 py-0.5 rounded-full font-black ${f.is_open ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{f.is_open ? "ABERTA" : "FECHADA"}</span>
                </div>
                <div className="mt-3 bg-card border border-border rounded-xl p-2">
                  <div className="aspect-[4/3] bg-secondary rounded-lg mb-1"/>
                  <p className="text-[10px] font-black">Item do cardápio</p>
                  <p className="text-[10px] text-primary font-black">R$ 25,00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
