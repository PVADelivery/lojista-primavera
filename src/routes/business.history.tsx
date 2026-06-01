import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyCompany } from "@/services/companies";
import { brl } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/business/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data: company } = useMyCompany();
  const [search, setSearch] = useState("");

  const { data: orders = [] } = useQuery({
    queryKey: ["hist-orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("company_id", company!.id).order("created_at",{ascending:false}).limit(500);
      return data ?? [];
    },
  });
  const { data: deliveries = [] } = useQuery({
    queryKey: ["hist-deliveries", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("deliveries").select("*").eq("company_id", company!.id).order("created_at",{ascending:false}).limit(500);
      return data ?? [];
    },
  });

  const filterFn = (rows: any[], key: string) => rows.filter(r =>
    !search || r.id.includes(search) || (r[key] ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="label-tiny">Arquivo</p>
        <h1 className="text-3xl font-black tracking-tight">Histórico</h1>
      </div>
      <Input placeholder="Buscar por ID ou nome do cliente..." value={search} onChange={(e)=>setSearch(e.target.value)} className="rounded-xl h-12 max-w-md"/>
      <Tabs defaultValue="market">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="market" className="rounded-xl">Marketplace</TabsTrigger>
          <TabsTrigger value="manual" className="rounded-xl">Entregas Manuais</TabsTrigger>
        </TabsList>
        <TabsContent value="market" className="mt-4">
          <Table rows={filterFn(orders,"customer_name")} kind="order"/>
        </TabsContent>
        <TabsContent value="manual" className="mt-4">
          <Table rows={filterFn(deliveries,"customer_name")} kind="delivery"/>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Table({ rows, kind }: { rows: any[]; kind: "order"|"delivery" }) {
  if (rows.length === 0) return (
    <div className="bg-card border border-dashed border-border rounded-[2rem] p-12 text-center">
      <HistoryIcon className="h-12 w-12 mx-auto text-muted-foreground/40"/>
      <p className="mt-3 text-muted-foreground">Nada por aqui ainda.</p>
    </div>
  );
  return (
    <div className="bg-card border border-border rounded-[2rem] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary"><tr>
            <th className="text-left p-3 font-black">ID</th>
            <th className="text-left p-3 font-black">Cliente</th>
            <th className="text-left p-3 font-black">Data</th>
            <th className="text-left p-3 font-black">Status</th>
            <th className="text-right p-3 font-black">Valor</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-secondary/40">
                <td className="p-3 font-mono text-xs">{r.id.slice(0,8)}</td>
                <td className="p-3 font-semibold">{r.customer_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-bold">{r.status}</span></td>
                <td className="p-3 text-right font-bold">{brl(kind==="order"?r.total:r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
