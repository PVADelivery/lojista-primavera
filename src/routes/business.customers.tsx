import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { Plus, Users, Phone } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { initials, formatPhone } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/business/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { data: company } = useMyCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", cpf: "" });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("*").eq("company_id", company!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filtered = customers.filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("customers").insert({ company_id: company!.id, ...f });
    if (error) toast.error(error.message);
    else { toast.success("Cliente cadastrado"); setOpen(false); setF({name:"",phone:"",cpf:""}); qc.invalidateQueries({queryKey:["customers"]}); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="label-tiny">Carteira</p>
          <h1 className="text-3xl font-black tracking-tight">Meus Clientes</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-2xl h-12 px-6 font-bold"><Plus className="h-4 w-4 mr-2"/>Novo Cliente</Button></DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Nome</Label><Input required value={f.name} onChange={(e)=>setF({...f,name:e.target.value})} className="rounded-xl h-11"/></div>
              <div><Label>Telefone</Label><Input value={f.phone} onChange={(e)=>setF({...f,phone:e.target.value})} className="rounded-xl h-11"/></div>
              <div><Label>CPF</Label><Input value={f.cpf} onChange={(e)=>setF({...f,cpf:e.target.value})} className="rounded-xl h-11"/></div>
              <Button type="submit" className="w-full rounded-xl h-11 font-bold">Cadastrar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e)=>setSearch(e.target.value)} className="rounded-xl h-12 max-w-md"/>

      {filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/40"/>
          <p className="mt-3 text-muted-foreground">Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-[2rem] p-5 flex items-center gap-4 hover:shadow-card transition">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center font-black text-lg flex-shrink-0">{initials(c.name)}</div>
              <div className="min-w-0 flex-1">
                <p className="font-black truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/>{formatPhone(c.phone)}</p>}
                {c.cpf && <p className="text-xs text-muted-foreground">CPF: {c.cpf}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
