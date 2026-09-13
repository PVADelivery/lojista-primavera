import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, X, Loader2, ListPlus, Sparkles, Check, ChevronDown, ChevronUp } from "lucide-react";
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

// Presets solicitados pelo usuário para acelerar o cadastro de itens
const PRESETS = [
  {
    title: "Sabores (Doces / Açaí / Sorvetes)",
    icon: "🍨",
    name: "Escolha o Sabor",
    min: 1,
    max: 1,
    required: true,
    options: [
      { name: "Chocolate", price: 0 },
      { name: "Morango", price: 0 },
      { name: "Ninho Trufado", price: 0 },
      { name: "Maracujá", price: 0 },
      { name: "Açaí Tradicional", price: 0 },
      { name: "Creme de Avelã / Nutella", price: 2.50 },
      { name: "Doce de Leite", price: 0 },
    ],
  },
  {
    title: "Numeração de Calçados (34 ao 44)",
    icon: "👟",
    name: "Tamanho / Numeração do Calçado",
    min: 1,
    max: 1,
    required: true,
    options: [
      { name: "34", price: 0 },
      { name: "35", price: 0 },
      { name: "36", price: 0 },
      { name: "37", price: 0 },
      { name: "38", price: 0 },
      { name: "39", price: 0 },
      { name: "40", price: 0 },
      { name: "41", price: 0 },
      { name: "42", price: 0 },
      { name: "43", price: 0 },
      { name: "44", price: 0 },
    ],
  },
  {
    title: "Tamanhos de Roupas / Geral (PP ao XGG)",
    icon: "👕",
    name: "Tamanho da Peça",
    min: 1,
    max: 1,
    required: true,
    options: [
      { name: "PP", price: 0 },
      { name: "P", price: 0 },
      { name: "M", price: 0 },
      { name: "G", price: 0 },
      { name: "GG", price: 0 },
      { name: "XGG", price: 0 },
      { name: "Tamanho Único", price: 0 },
    ],
  },
  {
    title: "Volumes / Copos (300ml a 1 Litro)",
    icon: "🥤",
    name: "Volume / Tamanho do Copo",
    min: 1,
    max: 1,
    required: true,
    options: [
      { name: "300ml", price: 0 },
      { name: "500ml", price: 5.00 },
      { name: "700ml", price: 9.00 },
      { name: "1 Litro", price: 14.00 },
    ],
  },
  {
    title: "Pizza Meio a Meio / Sabores",
    icon: "🍕",
    name: "Sabores da Pizza (Até 2 Sabores)",
    min: 1,
    max: 2,
    required: true,
    options: [
      { name: "Calabresa com Cebola", price: 0 },
      { name: "Mussarela Especial", price: 0 },
      { name: "Frango com Catupiry", price: 0 },
      { name: "Portuguesa Completa", price: 0 },
      { name: "Quatro Queijos", price: 3.00 },
    ],
  },
];

export function ProductOptionsManager({ productId, productName, onClose }: { 
  productId: string; 
  productName: string;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(true);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMin, setNewGroupMin] = useState(0);
  const [newGroupMax, setNewGroupMax] = useState(1);
  const [newGroupReq, setNewGroupReq] = useState(false);

  // New option state per group
  const [activeNewOptionGroup, setActiveNewOptionGroup] = useState<string | null>(null);
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionPrice, setNewOptionPrice] = useState("0");
  const [creatingPreset, setCreatingPreset] = useState(false);

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
        } else {
          setOptions({});
        }
      }
    } catch (err) {
      console.error("Erro ao carregar complementos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error("Informe o nome do grupo!");
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from("product_option_groups")
        .insert([{ 
          product_id: productId, 
          name: newGroupName.trim(), 
          min_options: newGroupMin, 
          max_options: newGroupMax, 
          required: newGroupReq 
        }])
        .select()
        .single();

      if (error) throw error;
      setGroups([...groups, data]);
      setNewGroupName("");
      setAddingGroup(false);
      toast.success("Grupo de variações criado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar grupo");
    }
  };

  const handleApplyPreset = async (preset: typeof PRESETS[0]) => {
    setCreatingPreset(true);
    try {
      // 1. Create Group
      const { data: groupData, error: groupErr } = await (supabase as any)
        .from("product_option_groups")
        .insert([{ 
          product_id: productId, 
          name: preset.name, 
          min_options: preset.min, 
          max_options: preset.max, 
          required: preset.required 
        }])
        .select()
        .single();

      if (groupErr) throw groupErr;

      // 2. Create Options
      const optionsToInsert = preset.options.map((opt) => ({
        group_id: groupData.id,
        name: opt.name,
        price: opt.price,
      }));

      const { data: createdOptions, error: optErr } = await (supabase as any)
        .from("product_options")
        .insert(optionsToInsert)
        .select();

      if (optErr) throw optErr;

      setGroups(prev => [...prev, groupData]);
      setOptions(prev => ({
        ...prev,
        [groupData.id]: createdOptions || []
      }));

      toast.success(`Preset "${preset.title}" adicionado com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao aplicar modelo pré-definido: " + err.message);
    } finally {
      setCreatingPreset(false);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Remover este grupo e todas as suas opções?")) return;
    const { error } = await (supabase as any).from("product_option_groups").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover grupo");
    } else {
      setGroups(groups.filter(g => g.id !== id));
      const newOpts = { ...options };
      delete newOpts[id];
      setOptions(newOpts);
      toast.success("Grupo removido");
    }
  };

  const handleAddOption = async (groupId: string) => {
    if (!newOptionName.trim()) {
      toast.error("Informe o nome da opção/sabor!");
      return;
    }
    const cleanPrice = parseFloat(newOptionPrice.replace(",", ".")) || 0;

    try {
      const { data, error } = await (supabase as any)
        .from("product_options")
        .insert([{ group_id: groupId, name: newOptionName.trim(), price: cleanPrice }])
        .select()
        .single();

      if (error) throw error;

      setOptions({
        ...options,
        [groupId]: [...(options[groupId] || []), data]
      });
      setNewOptionName("");
      setNewOptionPrice("0");
      setActiveNewOptionGroup(null);
      toast.success("Opção adicionada!");
    } catch (err: any) {
      toast.error("Erro ao adicionar item: " + err.message);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-foreground tracking-tight">Variações & Sabores</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              {productName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure sabores, numeração de calçados, tamanhos de roupas ou adicionais pagos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setAddingGroup(true)}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 shadow-sm hover:brightness-105 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" /> Criar Grupo Manual
          </button>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modelos Rápidos (1-Click Presets) */}
      <div className="bg-gradient-to-r from-amber-500/10 via-primary/5 to-purple-500/10 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
            Modelos Prontos (Clique para adicionar ao produto)
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              disabled={creatingPreset}
              onClick={() => handleApplyPreset(preset)}
              className="px-3 py-2 rounded-xl bg-background border border-border/80 hover:border-primary hover:bg-primary/5 text-xs font-bold text-foreground flex items-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <span className="text-base">{preset.icon}</span>
              <span>{preset.title}</span>
              <Plus className="h-3.5 w-3.5 text-primary ml-1" />
            </button>
          ))}
        </div>
      </div>

      {/* Modal/Box de Criação de Grupo Manual */}
      {addingGroup && (
        <form onSubmit={handleCreateGroup} className="bg-card border-2 border-primary/30 rounded-2xl p-5 shadow-md space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">Novo Grupo de Opções / Tamanhos</h4>
            <button type="button" onClick={() => setAddingGroup(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Nome do Grupo</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex: Escolha o Sabor, Numeração do Calçado, Tamanho..."
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Mínimo</label>
                <input
                  type="number"
                  min="0"
                  value={newGroupMin}
                  onChange={(e) => setNewGroupMin(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-medium text-center"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">Máximo</label>
                <input
                  type="number"
                  min="1"
                  value={newGroupMax}
                  onChange={(e) => setNewGroupMax(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm font-medium text-center"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
              <input
                type="checkbox"
                checked={newGroupReq}
                onChange={(e) => setNewGroupReq(e.target.checked)}
                className="w-4 h-4 rounded accent-primary cursor-pointer"
              />
              Obrigatório (o cliente deve escolher ao menos 1 item para comprar)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddingGroup(false)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:brightness-105"
              >
                Salvar Grupo
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Lista de Grupos Existentes */}
      {loading || creatingPreset ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Carregando variações do produto...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-muted/30 border-2 border-dashed border-border rounded-3xl p-12 text-center">
          <ListPlus className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-foreground mb-1">Nenhuma variação ou tamanho cadastrado</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Utilize os <strong>Modelos Prontos</strong> acima para adicionar Sabores, Numeração de Calçados ou Tamanhos em 1 clique!
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
              {/* Group Header */}
              <div className="bg-muted/40 p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input 
                      value={group.name} 
                      onChange={(e) => updateGroup(group, "name", e.target.value)}
                      className="bg-transparent font-black text-foreground text-base outline-none border-b border-transparent focus:border-primary px-1 hover:border-border transition-colors max-w-md"
                    />
                    <button 
                      onClick={() => deleteGroup(group.id)} 
                      title="Excluir grupo"
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Controls */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-muted-foreground">
                    <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-lg border border-border">
                      <span>Mín:</span>
                      <input 
                        type="number" 
                        value={group.min_options} 
                        onChange={(e) => updateGroup(group, "min_options", parseInt(e.target.value) || 0)}
                        className="w-10 bg-transparent text-foreground outline-none text-center font-bold"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-background px-2.5 py-1 rounded-lg border border-border">
                      <span>Máx:</span>
                      <input 
                        type="number" 
                        value={group.max_options} 
                        onChange={(e) => updateGroup(group, "max_options", parseInt(e.target.value) || 1)}
                        className="w-10 bg-transparent text-foreground outline-none text-center font-bold"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer bg-background px-2.5 py-1 rounded-lg border border-border select-none">
                      <input 
                        type="checkbox" 
                        checked={group.required} 
                        onChange={(e) => updateGroup(group, "required", e.target.checked)}
                        className="accent-primary rounded"
                      />
                      <span>Obrigatório</span>
                    </label>
                  </div>
                </div>

                <div>
                  <button 
                    onClick={() => setActiveNewOptionGroup(activeNewOptionGroup === group.id ? null : group.id)}
                    className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-all flex items-center gap-1.5 w-full sm:w-auto justify-center"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar Opção
                  </button>
                </div>
              </div>

              {/* Inline Add Option Form */}
              {activeNewOptionGroup === group.id && (
                <div className="p-3.5 bg-primary/5 border-b border-primary/20 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in">
                  <input
                    type="text"
                    value={newOptionName}
                    onChange={(e) => setNewOptionName(e.target.value)}
                    placeholder="Nome da opção (ex: Sabor Ninho, Calçado nº 38, Tam M...)"
                    className="flex-1 w-full px-3 py-1.5 bg-background border border-border rounded-xl text-xs font-medium outline-none focus:border-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddOption(group.id);
                    }}
                  />
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-xs text-muted-foreground font-bold">R$</span>
                    <input
                      type="text"
                      value={newOptionPrice}
                      onChange={(e) => setNewOptionPrice(e.target.value)}
                      placeholder="0,00"
                      className="w-20 px-2 py-1.5 bg-background border border-border rounded-xl text-xs font-medium text-center outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => handleAddOption(group.id)}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:brightness-105 whitespace-nowrap"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => setActiveNewOptionGroup(null)}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Options List */}
              <div className="divide-y divide-border/60">
                {options[group.id]?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:gap-2 p-2">
                    {options[group.id].map((opt) => (
                      <div 
                        key={opt.id} 
                        className="p-2.5 bg-background rounded-xl border border-border/50 flex items-center justify-between hover:border-border transition-colors group/item"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full bg-primary/60" />
                          <div>
                            <p className="text-xs font-bold text-foreground">{opt.name}</p>
                            <p className="text-[11px] text-primary font-black">
                              {opt.price > 0 ? `+ R$ ${opt.price.toFixed(2).replace(".", ",")}` : "Sem custo extra"}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteOption(group.id, opt.id)} 
                          title="Excluir opção"
                          className="opacity-60 group-hover/item:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Nenhuma opção cadastrada neste grupo. Clique em "+ Adicionar Opção" acima.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

