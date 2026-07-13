import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, X, Loader2, ListPlus, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  min_options: number;
  max_options: number;
  required: boolean;
}

interface Option {
  id: string;
  group_id: string;
  name: string;
  price: number;
}

export function ProductOptionsManager({ productId, productName, onClose }: { 
  productId: string; 
  productName: string;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: groupsData } = await (supabase as any)
        .from("product_option_groups")
        .select("*")
        .eq("product_id", productId)
        .order("created_at");

      if (groupsData) {
        setGroups(groupsData);
        
        const groupIds = groupsData.map((g: any) => g.id);
        if (groupIds.length > 0) {
          const { data: optionsData } = await (supabase as any)
            .from("product_options")
            .select("*")
            .in("group_id", groupIds)
            .order("created_at");

          const optsMap: Record<string, Option[]> = {};
          optionsData?.forEach((opt: any) => {
            if (!optsMap[opt.group_id]) optsMap[opt.group_id] = [];
            optsMap[opt.group_id].push(opt);
          });
          setOptions(optsMap);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar complementos:", err);
    } finally {
      setLoading(false);
    }
  };

  const addGroup = async () => {
    const name = prompt("Nome do grupo (ex: Turbine seu Lanche, Adicionais...)");
    if (!name) return;

    const { data, error } = await (supabase as any)
      .from("product_option_groups")
      .insert([{ product_id: productId, name, min_options: 0, max_options: 10, required: false }])
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar grupo");
    } else {
      setGroups([...groups, data]);
      toast.success("Grupo criado!");
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Remover este grupo e todos os seus itens?")) return;
    const { error } = await (supabase as any).from("product_option_groups").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover grupo");
    } else {
      setGroups(groups.filter(g => g.id !== id));
      toast.success("Grupo removido");
    }
  };

  const addOption = async (groupId: string) => {
    const name = prompt("Nome do item (ex: Bacon, Molho Verde, Queijo Extra...)");
    if (!name) return;
    const priceStr = prompt("Preço adicional (0 para grátis)", "0");
    const price = parseFloat(priceStr || "0");

    const { data, error } = await (supabase as any)
      .from("product_options")
      .insert([{ group_id: groupId, name, price }])
      .select()
      .single();

    if (error) {
      toast.error("Erro ao adicionar item");
    } else {
      setOptions({
        ...options,
        [groupId]: [...(options[groupId] || []), data]
      });
      toast.success("Item adicionado!");
    }
  };

  const deleteOption = async (groupId: string, optionId: string) => {
    const { error } = await (supabase as any).from("product_options").delete().eq("id", optionId);
    if (error) {
      toast.error("Erro ao remover item");
    } else {
      setOptions({
        ...options,
        [groupId]: options[groupId].filter(o => o.id !== optionId)
      });
    }
  };

  const updateGroup = async (group: Group, field: keyof Group, value: any) => {
    const { error } = await (supabase as any)
      .from("product_option_groups")
      .update({ [field]: value })
      .eq("id", group.id);
    
    if (error) {
      toast.error("Erro ao atualizar");
    } else {
      setGroups(groups.map(g => g.id === group.id ? { ...g, [field]: value } : g));
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground">Complementos: {productName}</h2>
          <p className="text-xs text-muted-foreground">Gerencie adicionais, molhos e opções de personalização.</p>
        </div>
        <button 
          onClick={addGroup}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo Grupo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-muted/30 border-2 border-dashed border-border rounded-3xl p-12 text-center">
          <ListPlus className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum complemento cadastrado para este produto.</p>
          <button onClick={addGroup} className="mt-4 text-primary text-xs font-bold underline">Criar primeiro grupo</button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
              {/* Group Header */}
              <div className="bg-muted/50 p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input 
                      value={group.name} 
                      onChange={(e) => updateGroup(group, "name", e.target.value)}
                      className="bg-transparent font-bold text-foreground outline-none border-b border-transparent focus:border-primary px-1"
                    />
                    <button onClick={() => deleteGroup(group.id)} className="text-destructive hover:scale-110 transition-transform">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                      <span>Mín:</span>
                      <input 
                        type="number" 
                        value={group.min_options} 
                        onChange={(e) => updateGroup(group, "min_options", parseInt(e.target.value))}
                        className="w-10 bg-background border rounded px-1 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>Máx:</span>
                      <input 
                        type="number" 
                        value={group.max_options} 
                        onChange={(e) => updateGroup(group, "max_options", parseInt(e.target.value))}
                        className="w-10 bg-background border rounded px-1 text-center"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={group.required} 
                        onChange={(e) => updateGroup(group, "required", e.target.checked)}
                        className="accent-primary"
                      />
                      <span>Obrigatório</span>
                    </label>
                  </div>
                </div>
                <button 
                  onClick={() => addOption(group.id)}
                  className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Item
                </button>
              </div>

              {/* Options List */}
              <div className="divide-y divide-border">
                {options[group.id]?.length > 0 ? (
                  options[group.id].map((opt) => (
                    <div key={opt.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground/30" />
                        <div>
                          <p className="text-sm font-bold text-foreground">{opt.name}</p>
                          <p className="text-xs text-primary font-black">
                            {opt.price > 0 ? `+ R$ ${opt.price.toFixed(2).replace(".", ",")}` : "Grátis"}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => deleteOption(group.id, opt.id)} className="p-2 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground">Nenhum item neste grupo.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
