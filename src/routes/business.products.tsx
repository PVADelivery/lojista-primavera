import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useMyCompany } from "@/services/companies";
import {
  Plus, Trash2, Edit3, Loader2, ImagePlus, Package,
  DollarSign, X, Check, Eye, EyeOff, ArrowLeft, Layers, ShoppingCart,
  GripVertical, ListPlus, Plug, Search,
} from "lucide-react";
import { ProductOptionsManager } from "@/components/business/ProductOptionsManager";
import { BulkImportModal } from "@/components/business/BulkImportModal";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  image_url: any;
  is_active: boolean;
  company_id: string;
  created_at: string;
  sort_order: number;
}

export const Route = createFileRoute("/business/products")({
  component: BusinessProductsPage,
});

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: "Lanches",           label: "🍔 Lanches" },
  { value: "CREMOSINHO GOURMET",label: "🍨 Cremosinho Gourmet" },
  { value: "Açaí",              label: "🍨 Açaí" },
  { value: "Pizza",             label: "🍕 Pizza" },
  { value: "Bebidas",           label: "🥤 Bebidas" },
  { value: "Doces",             label: "🍫 Doces" },
  { value: "Sobremesas",        label: "🍰 Sobremesas" },
  { value: "Combos",            label: "🍱 Combos" },
  { value: "Mercado",           label: "🛒 Mercado" },
  { value: "Farmácia",          label: "💊 Farmácia" },
  { value: "Pet Shop",          label: "🐾 Pet Shop" },
  { value: "Shopping",          label: "🛍️ Shopping" },
  { value: "Outros",            label: "🏷️ Categoria Geral (Outros)" },
];

function parseImages(imageUrl: string | null): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) return parsed.filter((u: any) => typeof u === "string" && u.startsWith("http"));
  } catch {
    if (imageUrl.startsWith("http")) return [imageUrl];
  }
  return [];
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function BusinessProductsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: company, isLoading: companyLoading } = useMyCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const companyId = company?.id;
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [managingOptions, setManagingOptions] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Drag state
  const dragId = useRef<string | null>(null);
  const dragCategory = useRef<string | null>(null);

  useEffect(() => {
    if (companyId) {
      fetchProducts(companyId);
    } else if (!companyLoading) {
      setLoading(false);
    }
  }, [companyId, companyLoading]);

  const fetchProducts = async (cId: string) => {
    setLoading(true);
    try {
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", cId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      setProducts(prods || []);
    } catch (err: any) {
      toast.error(`Falha ao carregar produtos: ${err.message || "Erro desconhecido"}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyAndProducts = () => {
    if (companyId) fetchProducts(companyId);
  };

  const toggleActive = async (product: Product) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(product.is_active ? "Produto desativado" : "Produto ativado");
      fetchCompanyAndProducts();
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Deseja realmente remover este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover produto");
    } else {
      toast.success("Produto removido");
      fetchCompanyAndProducts();
    }
  };

  // ── Drag & Drop handlers ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((id: string, category: string) => {
    dragId.current = id;
    dragCategory.current = category;
  }, []);

  const handleDrop = useCallback(async (targetId: string, targetCategory: string) => {
    const srcId = dragId.current;
    const srcCat = dragCategory.current;
    if (!srcId || srcId === targetId || srcCat !== targetCategory) return;

    const catProducts = products.filter(p => p.category === targetCategory);
    const srcIdx = catProducts.findIndex(p => p.id === srcId);
    const tgtIdx = catProducts.findIndex(p => p.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const reordered = [...catProducts];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    const updated = reordered.map((p, i) => ({ ...p, sort_order: i }));

    // Optimistic UI
    setProducts(prev =>
      prev.map(p => {
        const found = updated.find(u => u.id === p.id);
        return found ?? p;
      })
    );

    // Persist
    try {
      await Promise.all(
        updated.map(p =>
          supabase.from("products").update({ sort_order: p.sort_order }).eq("id", p.id)
        )
      );
      toast.success("Ordem salva!");
    } catch {
      toast.error("Erro ao salvar ordem");
      fetchCompanyAndProducts();
    }

    dragId.current = null;
    dragCategory.current = null;
  }, [products]);

  // ── Views ────────────────────────────────────────────────────────────────────
  if (managingOptions) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        <button
          onClick={() => setManagingOptions(null)}
          className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Cardápio
        </button>
        <ProductOptionsManager
          productId={managingOptions.id}
          productName={managingOptions.name}
          onClose={() => setManagingOptions(null)}
        />
      </div>
    );
  }

  // List of existing categories across all products
  const existingCategories = useMemo(() => {
    const list: string[] = [];
    products.forEach((p) => {
      const c = (p.category || "").trim();
      if (c && !list.includes(c)) list.push(c);
    });
    return list;
  }, [products]);

  if (showForm || editingProduct) {
    return (
      <div className="max-w-4xl mx-auto">
        <ProductForm
          companyId={companyId!}
          userId={user?.id}
          product={editingProduct}
          categoryCount={
            editingProduct
              ? products.filter(p => p.category === editingProduct.category).length
              : 0
          }
          existingCategories={existingCategories}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          onSaved={() => { setShowForm(false); setEditingProduct(null); fetchCompanyAndProducts(); }}
        />
      </div>
    );
  }

  // Group by category dynamically — NEVER drop or hide any product!
  const grouped = useMemo(() => {
    if (!products || products.length === 0) return [];

    const defaultLabels: Record<string, string> = {
      Lanches: "🍔 Lanches",
      "CREMOSINHO GOURMET": "🍨 Cremosinho Gourmet",
      Açaí: "🍨 Açaí",
      "Açai": "🍨 Açaí",
      Pizza: "🍕 Pizza",
      Bebidas: "🥤 Bebidas",
      Doces: "🍫 Doces",
      Sobremesas: "🍰 Sobremesas",
      Combos: "🍱 Combos",
      Mercado: "🛒 Mercado",
      Farmácia: "💊 Farmácia",
      "Pet Shop": "🐾 Pet Shop",
      Shopping: "🛍️ Shopping",
      Outros: "🏷️ Categoria Geral (Outros)",
    };

    const catMap = new Map<string, Product[]>();

    products.forEach((p) => {
      const rawCat = (p.category || "").trim();
      const catKey = rawCat || "Geral";
      if (!catMap.has(catKey)) {
        catMap.set(catKey, []);
      }
      catMap.get(catKey)!.push(p);
    });

    const result: { cat: { value: string; label: string }; items: Product[] }[] = [];

    // Prioridade para as categorias conhecidas na ordem de CATEGORY_OPTIONS
    CATEGORY_OPTIONS.forEach((opt) => {
      if (catMap.has(opt.value)) {
        const items = catMap.get(opt.value)!;
        result.push({
          cat: opt,
          items: items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        });
        catMap.delete(opt.value);
      }
    });

    // Em seguida adicionar todas as categorias personalizadas presentes nos produtos (ex: "CREMOSINHO GOURMET")
    catMap.forEach((items, catKey) => {
      const label = defaultLabels[catKey] || `🏷️ ${catKey}`;
      result.push({
        cat: { value: catKey, label },
        items: items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      });
    });

    return result;
  }, [products]);

  // Filtragem combinada por busca e categoria selecionada
  const filteredGrouped = useMemo(() => {
    let list = grouped;
    if (selectedCategory !== "all") {
      list = list.filter((g) => g.cat.value === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list
        .map((g) => ({
          ...g,
          items: g.items.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              (p.description && p.description.toLowerCase().includes(q)) ||
              (p.category && p.category.toLowerCase().includes(q))
          ),
        }))
        .filter((g) => g.items.length > 0);
    }
    return list;
  }, [grouped, selectedCategory, searchQuery]);

  const totalFilteredCount = useMemo(() => {
    return filteredGrouped.reduce((sum, g) => sum + g.items.length, 0);
  }, [filteredGrouped]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-foreground tracking-tight">Seu Catálogo</h2>
          <p className="text-muted-foreground text-sm font-medium">
            Organize os itens que seus clientes podem comprar no marketplace.
          </p>
          <p className="text-xs text-primary/80 font-bold mt-1 flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Arraste os cards para reordenar dentro de cada categoria
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/business/integrations"
            className="px-5 py-4 rounded-[2rem] bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all text-sm"
          >
            <span className="font-black">iF</span>
            Integração iFood
          </Link>
          <button
            onClick={() => setShowBulkImport(true)}
            disabled={!companyId}
            className="px-6 py-4 rounded-[2rem] bg-secondary text-secondary-foreground font-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 text-sm"
          >
            <ListPlus className="h-5 w-5" />
            Importar em Lote
          </button>
          <button
            onClick={() => setShowForm(true)}
            disabled={!companyId}
            className="px-8 py-4 rounded-[2rem] bg-primary text-primary-foreground font-black flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 text-sm"
          >
            <Plus className="h-6 w-6" />
            Novo Item
          </button>
        </div>
      </div>

      {/* ── Barra de Categorias e Busca Estilo Loja ── */}
      {products.length > 0 && (
        <div className="space-y-4">
          {/* Busca & Contadores */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar produto ou sabor..."
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-card border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm font-bold shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="text-xs font-bold text-muted-foreground flex items-center gap-2 self-end sm:self-center">
              <span className="px-3 py-1.5 rounded-full bg-muted border border-border">
                {totalFilteredCount} {totalFilteredCount === 1 ? "item exibido" : "itens exibidos"}
              </span>
              {(selectedCategory !== "all" || searchQuery) && (
                <button
                  type="button"
                  onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}
                  className="text-xs font-bold text-primary hover:underline ml-1"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {/* Abas Deslizáveis de Categoria */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "shrink-0 px-4 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 shadow-sm",
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span>✨ Todas</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black",
                selectedCategory === "all" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {products.length}
              </span>
            </button>

            {grouped.map(({ cat, items }) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={cn(
                  "shrink-0 px-4 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 shadow-sm",
                  selectedCategory === cat.value
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>{cat.label}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black",
                  selectedCategory === cat.value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}>
                  {items.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Carregando Itens...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-[3rem] p-20 text-center shadow-card">
          <div className="w-24 h-24 rounded-[2rem] bg-muted/50 flex items-center justify-center mx-auto mb-8">
            <Package className="h-12 w-12 text-muted-foreground/30" />
          </div>
          <h3 className="text-2xl font-black text-foreground mb-4">Seu cardápio está vazio</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-10 font-medium">
            Adicione fotos apetitosas e descrições detalhadas para vender mais.
          </p>
          <button
            onClick={() => setShowForm(true)}
            disabled={!companyId}
            className="px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-lg shadow-xl disabled:opacity-50"
          >
            Começar agora
          </button>
        </div>
      ) : filteredGrouped.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-3xl p-16 text-center shadow-sm">
          <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-lg font-black text-foreground mb-2">Nenhum item encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Nenhum produto correspondeu ao filtro ou termo "{searchQuery}".
          </p>
          <button
            onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
          >
            Ver todos os produtos
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredGrouped.map(({ cat, items }) => (
            <section key={cat.value}>
              {/* Category header */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">{cat.label.split(" ")[0]}</span>
                <div>
                  <h3 className="font-black text-xl tracking-tight">
                    {cat.label.replace(/^\S+\s/, "")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? "item" : "itens"} · arraste para reordenar
                  </p>
                </div>
                <div className="flex-1 border-b border-dashed border-border/60 ml-2" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={() => setEditingProduct(product)}
                    onDelete={() => deleteProduct(product.id)}
                    onToggle={() => toggleActive(product)}
                    onDragStart={() => handleDragStart(product.id, product.category ?? "")}
                    onDrop={() => handleDrop(product.id, product.category ?? "")}
                    onManageOptions={() => setManagingOptions(product)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      
      {/* BulkImportModal — always mounted so it works from any state */}
      <BulkImportModal 
        isOpen={showBulkImport} 
        onClose={() => setShowBulkImport(false)} 
        onSuccess={() => { setShowBulkImport(false); fetchCompanyAndProducts(); }} 
        companyId={companyId ?? ""} 
      />
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, onEdit, onDelete, onToggle, onDragStart, onDrop, onManageOptions }: any) {
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [isOverLocal, setIsOverLocal] = useState(false);
  
  const parsedImages = parseImages(product.image_url);
  const mainImage = parsedImages.length > 0 ? parsedImages[0] : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        setIsDraggingLocal(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDraggingLocal(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOverLocal(true);
      }}
      onDragLeave={() => {
        setIsOverLocal(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsOverLocal(false);
        onDrop();
      }}
      className={cn(
        "bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col",
        !product.is_active && "opacity-75 grayscale-[0.3]",
        isDraggingLocal ? "opacity-40 scale-95 cursor-grabbing shadow-none" : "cursor-grab hover:-translate-y-1",
        isOverLocal ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "",
      )}
    >
      {/* Drag Handle — visible on hover */}
      <div className="absolute top-3 left-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wide shadow-md">
          <GripVertical className="h-3 w-3" />
          Arrastar
        </span>
      </div>

      {/* Image Container */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden shrink-0">
        {mainImage ? (
          <img src={mainImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <ImagePlus className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Badges Top Right */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {!product.is_active && (
            <div className="bg-destructive text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-wider shadow-sm">
              Pausado
            </div>
          )}
          <div className="bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
            <ShoppingCart className="h-3 w-3" /> Marketplace
          </div>
        </div>

        {/* Floating Price */}
        <div className="absolute bottom-3 left-3">
          <div className="bg-background/95 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-border/50 shadow-md">
            <p className="text-primary font-black text-sm tracking-tight">
              {brl(product.price)}
            </p>
          </div>
        </div>
      </div>

      {/* Info & Actions Container */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex-1">
          <h3 className="font-bold text-foreground text-base leading-snug line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 font-medium leading-relaxed">
            {product.description || "Sem descrição disponível"}
          </p>
        </div>

        {/* Actions Flex */}
        <div className="flex items-center gap-1.5 pt-3 mt-3 border-t border-border/50">
          <button
            onClick={onEdit}
            className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold tracking-wide hover:brightness-110 transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <Edit3 className="h-3.5 w-3.5" /> Editar
          </button>
          
          <button
            onClick={onManageOptions}
            className="h-9 px-2.5 shrink-0 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white flex items-center gap-1 transition-all text-[11px] font-black border border-amber-500/20 shadow-sm"
            title="Sabores, Numeração de Calçados, Tamanhos e Complementos"
          >
            <ListPlus className="h-3.5 w-3.5" />
            <span>Opções</span>
          </button>
          
          <button
            onClick={onToggle}
            className="h-9 w-9 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-all"
            title={product.is_active ? "Pausar Vendas" : "Ativar Vendas"}
          >
            {product.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-500" />}
          </button>
          
          <button
            onClick={onDelete}
            className="h-9 w-9 shrink-0 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white flex items-center justify-center transition-all"
            title="Remover produto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Product Form ──────────────────────────────────────────────────────────────
function ProductForm({
  companyId, userId, product, categoryCount, onClose, onSaved, existingCategories = [],
}: {
  companyId: string;
  userId?: string;
  product: Product | null;
  categoryCount: number;
  onClose: () => void;
  onSaved: () => void;
  existingCategories?: string[];
}) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [category, setCategory] = useState(product?.category || "Lanches");
  const [isAddingCustomCat, setIsAddingCustomCat] = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [imageUrls, setImageUrls] = useState<string[]>(product?.image_url ? parseImages(product.image_url) : []);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Unifica todas as categorias: padrão + categorias existentes na loja + categoria atual
  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    CATEGORY_OPTIONS.forEach(c => map.set(c.value, c.label));
    existingCategories.forEach(c => {
      if (c && !map.has(c)) map.set(c, `🏷️ ${c}`);
    });
    if (product?.category && !map.has(product.category)) {
      map.set(product.category, `🏷️ ${product.category}`);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [existingCategories, product?.category]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (!val) { setPrice(""); return; }
    const num = parseInt(val, 10) / 100;
    setPrice(num.toFixed(2));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId || !userId) return;

    if (imageUrls.length >= 3) { toast.error("Máximo de 3 fotos"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande! Limite de 5MB."); return; }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `product-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userId}/products/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("store-assets").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("store-assets").getPublicUrl(filePath);
      setImageUrls([...imageUrls, data.publicUrl]);
      toast.success("Foto do produto enviada!");
    } catch (error: any) {
      toast.error(`Falha ao enviar imagem: ${error.message || "Erro desconhecido"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => setImageUrls(imageUrls.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = (isAddingCustomCat && customCatInput.trim() ? customCatInput.trim() : category).trim() || "Geral";

    setSaving(true);
    try {
      const imagePayload = JSON.stringify(imageUrls);
      const payload: Record<string, unknown> = {
        name,
        description: description || null,
        category: finalCategory,
        price: parseFloat(price.replace(",", ".")),
        image_url: imagePayload,
      };

      if (product) {
        const { error } = await supabase.from("products").update(payload as any).eq("id", product.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        // New product appended at end of its category
        payload.sort_order = categoryCount;
        const { error } = await supabase
          .from("products")
          .insert([{ ...payload, company_id: companyId, is_active: true } as any]);
        if (error) throw error;
        toast.success("Produto publicado!");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <button
        onClick={onClose}
        className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Cardápio
      </button>

      <div className="bg-card border border-border rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
                <Package className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-black text-foreground">Detalhes do Item</h2>
            </div>

            <div className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Nome do Produto *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Combo X-Brasil"
                  className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Categoria *</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustomCat(!isAddingCustomCat)}
                    className="text-[11px] font-bold text-primary hover:underline"
                  >
                    {isAddingCustomCat ? "← Escolher da lista" : "+ Nova Categoria"}
                  </button>
                </div>

                {isAddingCustomCat ? (
                  <input
                    value={customCatInput}
                    onChange={e => setCustomCatInput(e.target.value)}
                    placeholder="Digite o nome da categoria (ex: Cremosinho Gourmet)"
                    className="w-full px-6 py-4 rounded-2xl border border-primary bg-background font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all text-base"
                    required
                    autoFocus
                  />
                ) : (
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all text-base"
                    required
                  >
                    <option value="">Selecione uma categoria</option>
                    {categoryOptions.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Price */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Preço de Venda *</label>
                <div className="relative">
                  <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                  <input
                    type="text"
                    required
                    value={price ? price.replace(".", ",") : ""}
                    onChange={handlePriceChange}
                    className="w-full pl-14 pr-6 py-4 rounded-2xl border border-border bg-background/50 font-black outline-none focus:border-primary transition-all text-lg"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Descrição / Ingredientes</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Os clientes são atraídos por boas descrições. Liste os ingredientes ou defina as propriedades do seu lanche."
                  rows={4}
                  className="w-full px-6 py-4 rounded-2xl border border-border bg-background/50 font-medium outline-none focus:border-primary resize-none transition-all placeholder:font-normal placeholder:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !name || !price}
              className="w-full py-5 rounded-[2rem] bg-primary text-primary-foreground text-lg font-black shadow-2xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 transition-all"
            >
              {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
              {saving ? "Publicando..." : product ? "Salvar Alterações" : "Adicionar ao Marketplace"}
            </button>
          </form>

          {/* Photos Section */}
          <div className="space-y-8 border-l border-border/50 lg:pl-12">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Fotos do Produto ({imageUrls.length}/3)</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-[2rem] overflow-hidden border border-border group shadow-lg">
                  <img src={url} alt="Prod" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-3 left-3 bg-primary text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg">
                      Principal
                    </div>
                  )}
                </div>
              ))}

              {imageUrls.length < 3 && (
                <div className="aspect-square rounded-[2rem] border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors">
                  <ImagePlus className="h-8 w-8 stroke-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Aguardando Foto</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input
                  type="file"
                  id="prod-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading || imageUrls.length >= 3}
                />
                <label
                  htmlFor="prod-upload"
                  className={cn(
                    "w-full py-8 rounded-[2rem] border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-primary/10 transition-all",
                    (isUploading || imageUrls.length >= 3) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <ImagePlus className="h-8 w-8 text-primary" />}
                  <div className="text-center">
                    <span className="text-sm font-black uppercase tracking-widest text-primary block">Tirar Foto / Galeria</span>
                    <span className="text-[10px] text-muted-foreground font-bold mt-1 block">Use a câmera ou escolha um arquivo</span>
                  </div>
                </label>
              </div>
              <p className="text-[9px] text-muted-foreground italic px-2">📸 Recomendamos fotos quadradas (1080x1080) com fundo limpo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
