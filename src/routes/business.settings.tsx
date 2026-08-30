import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Store, Camera, ImagePlus, Loader2, Save, User, MapPin, Phone, 
  Smartphone, Eye, Layers, Info, CheckCircle2, Pencil, X, Link as LinkIcon, 
  Clock3, DollarSign, Maximize2, MapPin as MapPinIcon, Crosshair, AlertTriangle,
  Trash2, Plus, ArrowRight, ShieldAlert, Sparkles, RefreshCw
} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";

const DEFAULT_WORKING_DAYS = [
  { day: 'Seg', active: true, start: '08:00', end: '18:00' },
  { day: 'Ter', active: true, start: '08:00', end: '18:00' },
  { day: 'Qua', active: true, start: '08:00', end: '18:00' },
  { day: 'Qui', active: true, start: '08:00', end: '18:00' },
  { day: 'Sex', active: true, start: '08:00', end: '18:00' },
  { day: 'Sab', active: true, start: '08:00', end: '12:00' },
  { day: 'Dom', active: false, start: '00:00', end: '00:00' },
];

const normalizeGallery = (value: any): string[] => {
  if (Array.isArray(value)) return value.filter((url) => typeof url === "string" && url.trim());
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((url) => typeof url === "string" && url.trim());
    } catch {}
    return value.split(",").map((url) => url.trim()).filter(Boolean);
  }
  if (value && typeof value === "object") return Object.values(value).filter((url) => typeof url === "string" && url.trim()) as string[];
  return [];
};

const normalizeWorkingDays = (value: any) => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }

  const rawDays = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.days)
      ? parsed.days
      : Array.isArray(parsed?.workingDays)
        ? parsed.workingDays
        : null;

  if (!rawDays) return DEFAULT_WORKING_DAYS.map((day) => ({ ...day }));

  return DEFAULT_WORKING_DAYS.map((defaultDay, index) => {
    const day = rawDays[index] || {};
    return {
      day: String(day.day || defaultDay.day),
      active: typeof day.active === "boolean" ? day.active : defaultDay.active,
      start: typeof day.start === "string" ? day.start : defaultDay.start,
      end: typeof day.end === "string" ? day.end : defaultDay.end,
    };
  });
};

export const Route = createFileRoute("/business/settings")({
  component: BusinessSettingsPage,
});

function BusinessSettingsPage() {
  const { user, profile, deleteAccount } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company data
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("restaurante");
  const [deliveryFee, setDeliveryFee] = useState("0.00");
  const [isOpen, setIsOpen] = useState(true);
  const [showInMarketplace, setShowInMarketplace] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [workingDays, setWorkingDays] = useState(() => DEFAULT_WORKING_DAYS.map((day) => ({ ...day })));
  const [activeSettingsTab, setActiveSettingsTab] = useState<"profile" | "hours" | "location" | "delivery" | "gallery" | "danger">("profile");
  
  // Delivery settings
  const [deliveryMode, setDeliveryMode] = useState<string>("fixed_fee");
  const [deliveryRegionsPricing, setDeliveryRegionsPricing] = useState<any[]>([]);
  const [allRegions, setAllRegions] = useState<any[]>([]);
  
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // Edit states for overlays
  const [isEditingLogo, setIsEditingLogo] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchCompanyData();

    // Subscribe to realtime changes for store status synchronization
    const channel = supabase
      .channel('store-status-sync-profile')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'companies',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new.is_open !== undefined) {
          setIsOpen(payload.new.is_open);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchCompanyData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) {
        setCompanyId(company.id);
        setStoreName(company.name || "");
        setPhone(company.phone || "");
        setAddress(company.address || "");
        setDescription(company.description || "");
        setLogoUrl(company.logo_url || "");
        setCoverUrl(company.cover_url || "");
        setCategory(company.category || "restaurante");
        setIsOpen(company.is_open ?? true);
        setShowInMarketplace(company.show_in_marketplace ?? false);
        setDeliveryFee(company.delivery_fee?.toString() || "0.00");
        setGallery(normalizeGallery(company.gallery));
        setWorkingDays(normalizeWorkingDays(company.business_hours));
        if (company.latitude) setLatitude(company.latitude);
        if (company.longitude) setLongitude(company.longitude);
        
        setDeliveryMode(company.delivery_mode || "fixed_fee");
        
        let parsedPricing: any[] = [];
        if (company.delivery_regions_pricing) {
          let matrix = company.delivery_regions_pricing;
          if (typeof matrix === 'string') {
            try { matrix = JSON.parse(matrix); } catch(e) {}
          }
          if (matrix && typeof matrix === 'object' && !Array.isArray(matrix) && matrix.matrix) {
            matrix = matrix.matrix;
          }
          if (Array.isArray(matrix)) {
            parsedPricing = matrix;
          }
        }
        setDeliveryRegionsPricing(parsedPricing);
      }

      // Fetch regions list
      const { data: regionsData } = await supabase
        .from("regions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (regionsData) {
        setAllRegions(regionsData);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  // Map Initialization (SSR Safe Dynamic Import)
  useEffect(() => {
    if (!isMapFullscreen || !mapContainerRef.current || typeof window === "undefined") return;
    
    let isMounted = true;
    if (mapRef.current) {
       mapRef.current.remove();
       mapRef.current = null;
    }

    const center = longitude && latitude ? [longitude, latitude] : [-54.3075, -15.5606];

    import("maplibre-gl").then((maplibregl) => {
      if (!isMounted || !mapContainerRef.current) return;
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            "osm-tiles": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
            },
          },
          layers: [{ id: "osm-layer", type: "raster", source: "osm-tiles" }],
        },
        center: [center[0], center[1]],
        zoom: 16,
        attributionControl: false,
      });
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isMapFullscreen]);

  const handleSetLocation = () => {
     if (mapRef.current) {
        const center = mapRef.current.getCenter();
        setLongitude(center.lng);
        setLatitude(center.lat);
        setIsMapFullscreen(false);
        toast.success("Localização atualizada! Não esqueça de salvar as alterações.");
     }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover') => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande! Limite de 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('store-assets')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      if (type === 'logo') {
        setLogoUrl(publicUrl);
        setTempUrl(publicUrl);
      } else {
        setCoverUrl(publicUrl);
        setTempUrl(publicUrl);
      }

      toast.success("Foto enviada com sucesso!", {
        description: "Lembre-se de clicar em 'Salvar Alterações'."
      });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error("Falha ao enviar imagem do dispositivo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user?.id) return;

    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} é muito grande! Pulei.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `gallery-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${user.id}/gallery/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('store-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('store-assets')
          .getPublicUrl(filePath);

        newUrls.push(data.publicUrl);
      }

      setGallery(prev => [...prev, ...newUrls]);
      toast.success(`${newUrls.length} foto(s) adicionada(s)!`);
    } catch (error: any) {
      console.error('Erro no upload da galeria:', error);
      toast.error("Erro ao enviar algumas fotos.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeGalleryItem = (url: string) => {
    setGallery(prev => prev.filter(item => item !== url));
  };

  const toggleStoreActive = async () => {
    const newActive = !isOpen;
    setIsOpen(newActive);
    if (!companyId) {
      toast.info("Lembre-se de salvar o perfil para aplicar as mudanças.");
      return;
    }
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_open: newActive })
        .eq("id", companyId);
      if (error) throw error;
      toast.success(
        newActive
          ? "Loja aberta para receber pedidos!"
          : "Loja fechada temporariamente."
      );
    } catch {
      setIsOpen(!newActive);
      toast.error("Erro ao atualizar status da loja");
    }
  };

  const toggleMarketplace = async () => {
    const newActive = !showInMarketplace;
    setShowInMarketplace(newActive);
    if (!companyId) {
      toast.info("Lembre-se de salvar o perfil para aplicar as mudanças.");
      return;
    }
    try {
      const { error } = await supabase
        .from("companies")
        .update({ show_in_marketplace: newActive })
        .eq("id", companyId);
      if (error) throw error;
      toast.success(
        newActive
          ? "Sua loja agora está visível no Marketplace!"
          : "Sua loja foi ocultada do Marketplace."
      );
    } catch {
      setShowInMarketplace(!newActive);
      toast.error("Erro ao atualizar visibilidade");
    }
  };

  const updateWorkingDay = (index: number, field: string, value: any) => {
    const newDays = [...workingDays];
    newDays[index] = { ...newDays[index], [field]: value };
    setWorkingDays(newDays);
  };

  const handleRegionPriceChange = (regionId: string, value: string) => {
    const cleanVal = value.replace(/[^0-9.,]/g, "");
    setDeliveryRegionsPricing((prev) => {
      const exists = prev.some((p) => p.region_id === regionId);
      if (exists) {
        return prev.map((p) => (p.region_id === regionId ? { ...p, price: cleanVal } : p));
      } else {
        return [...prev, { region_id: regionId, price: cleanVal }];
      }
    });
  };

  const handleFillDefaultPrices = () => {
    const defaultPricing = allRegions.map((region) => {
      const priceStr = Number(region.price || 0).toFixed(2).replace(".", ",");
      return {
        region_id: region.id,
        price: priceStr,
      };
    });
    setDeliveryRegionsPricing(defaultPricing);
    toast.success("Valores padrão do sistema carregados com sucesso!");
  };

  const getRegionPriceValue = (region: any) => {
    const match = deliveryRegionsPricing.find((p) => p.region_id === region.id);
    if (match && match.price !== undefined && match.price !== null && match.price !== "") {
      return String(match.price).replace(".", ",");
    }
    if (region.price !== undefined && region.price !== null) {
      const num = Number(region.price);
      return isNaN(num) ? "" : num.toFixed(2).replace(".", ",");
    }
    return "";
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      // Garantir que a tabela de regiões tenha todos os preços preenchidos (personalizados ou padrão do admin)
      const completeRegionsPricing = allRegions.map((region) => {
        const match = deliveryRegionsPricing.find((p) => p.region_id === region.id);
        let rawVal = match?.price;
        if (rawVal === undefined || rawVal === null || rawVal === "") {
          rawVal = region.price !== undefined && region.price !== null ? String(region.price) : "0";
        }
        const numericVal = parseFloat(String(rawVal).replace(/\./g, "").replace(",", ".")) || 0;
        return {
          region_id: region.id,
          price: numericVal.toFixed(2),
        };
      });

      const payload = {
          name: storeName,
          phone: phone.replace(/[^0-9]/g, ""),
          address,
          description,
          logo_url: logoUrl,
          cover_url: coverUrl,
          category: category,
          delivery_mode: deliveryMode,
          delivery_fee: deliveryMode === "fixed_fee" ? parseFloat(deliveryFee.replace(',', '.')) || 0 : 0,
          delivery_regions_pricing: completeRegionsPricing,
          is_open: isOpen,
          show_in_marketplace: showInMarketplace,
          business_hours: JSON.stringify(workingDays),
          gallery: gallery,
          latitude: latitude,
          longitude: longitude
      };

      if (companyId) {
        const { error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", companyId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("companies")
          .insert({
             ...payload,
             user_id: user?.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (data) setCompanyId(data.id);
      }

      qc.invalidateQueries({ queryKey: ["my-company"] });
      toast.success("Configurações salvas com sucesso!", {
        description: "Suas mudanças já estão ativas.",
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const TABS = [
    { id: "profile", label: "Perfil & Negócio", icon: Store },
    { id: "hours", label: "Horários", icon: Clock3 },
    { id: "location", label: "Contato & Localização", icon: MapPin },
    { id: "delivery", label: "Taxas de Entrega", icon: DollarSign },
    { id: "gallery", label: "Galeria de Fotos", icon: ImagePlus },
    { id: "danger", label: "Conta", icon: AlertTriangle },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-in fade-in duration-300">
      
      {/* ── Top Header com Botão Salvar Fixo ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">{storeName || "Configurações da Loja"}</h1>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border",
              isOpen 
                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" 
                : "bg-rose-500/15 text-rose-600 border-rose-500/30"
            )}>
              {isOpen ? "Aberta" : "Fechada"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie os dados e configurações do seu estabelecimento</p>
        </div>

        <button 
          onClick={() => handleSave()}
          disabled={saving}
          className="px-6 h-12 rounded-2xl bg-foreground text-background hover:bg-primary hover:text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer shrink-0"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {/* ── Sub-Abas de Navegação Limpas e Elegantes ── */}
      <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-secondary/50 rounded-2xl border border-border">
        {TABS.map((tab) => {
          const isActive = activeSettingsTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSettingsTab(tab.id as any)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer",
                isActive
                  ? "bg-card text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: PERFIL & NEGÓCIO ── */}
      {activeSettingsTab === "profile" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Banner & Logo Card */}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="relative h-48 sm:h-64 bg-muted group/banner">
              {coverUrl ? (
                <img src={coverUrl} className="w-full h-full object-cover" alt="Banner" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-muted-foreground">
                  <Camera className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-xs font-bold">Sem imagem de capa</p>
                </div>
              )}
              
              <button 
                onClick={() => { setIsEditingCover(true); setTempUrl(coverUrl); }}
                className="absolute top-4 right-4 px-4 py-2 bg-black/70 hover:bg-black/90 text-white rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-sm transition-all shadow-lg"
              >
                <Camera className="h-4 w-4" /> Alterar Capa
              </button>

              {/* Logo Flutuante */}
              <div className="absolute -bottom-10 left-6 sm:left-8">
                <div className="relative group/avatar">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-card p-1.5 shadow-xl border-2 border-border overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} className="w-full h-full object-cover rounded-xl" alt="Logo" />
                    ) : (
                      <div className="w-full h-full bg-secondary rounded-xl flex items-center justify-center text-muted-foreground">
                        <Store className="h-8 w-8 opacity-40" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setIsEditingLogo(true); setTempUrl(logoUrl); }}
                    className="absolute -bottom-2 -right-2 p-2 bg-primary text-black font-bold rounded-xl shadow-md hover:scale-105 transition-transform"
                    title="Alterar Logo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-14 p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome do Estabelecimento</label>
                  <input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Burger Prime"
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Categoria / Ramo</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm appearance-none cursor-pointer"
                  >
                    <option value="restaurante">Restaurante</option>
                    <option value="mercado">Mercado / Mercearia</option>
                    <option value="farmacia">Farmácia / Drogaria</option>
                    <option value="lanches">Lanches / Fast Food</option>
                    <option value="pizza">Pizzaria</option>
                    <option value="bebidas">Adega / Bebidas</option>
                    <option value="doces">Doceria / Sobremesas</option>
                    <option value="pet">Pet Shop / Agro</option>
                    <option value="shopping">Shopping / Variedades</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Bio / Descrição do Estabelecimento</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva seu restaurante, especialidades ou diferenciais..."
                  rows={3}
                  className="w-full p-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium text-sm resize-none"
                />
              </div>

              {/* Status Switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={toggleStoreActive}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer text-left",
                    isOpen
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-muted/40 border-border"
                  )}
                >
                  <div>
                    <p className={cn("text-xs font-black uppercase tracking-wider", isOpen ? "text-emerald-600" : "text-muted-foreground")}>
                      {isOpen ? "✅ Loja Aberta" : "⏸️ Loja Fechada"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {isOpen ? "Recebendo novos pedidos" : "Pedidos temporariamente suspensos"}
                    </p>
                  </div>
                  <div className={cn(
                    "w-12 h-7 rounded-full p-1 transition-colors",
                    isOpen ? "bg-emerald-500" : "bg-muted-foreground/30"
                  )}>
                    <div className={cn("w-5 h-5 rounded-full bg-white transition-transform", isOpen ? "translate-x-5" : "translate-x-0")} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={toggleMarketplace}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer text-left",
                    showInMarketplace
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/40 border-border"
                  )}
                >
                  <div>
                    <p className={cn("text-xs font-black uppercase tracking-wider", showInMarketplace ? "text-foreground" : "text-muted-foreground")}>
                      {showInMarketplace ? "🌟 Visível no Marketplace" : "🙈 Oculta no Marketplace"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {showInMarketplace ? "Aparece na lista de lojas" : "Acessível apenas por link"}
                    </p>
                  </div>
                  <div className={cn(
                    "w-12 h-7 rounded-full p-1 transition-colors",
                    showInMarketplace ? "bg-primary" : "bg-muted-foreground/30"
                  )}>
                    <div className={cn("w-5 h-5 rounded-full bg-white transition-transform", showInMarketplace ? "translate-x-5" : "translate-x-0")} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: HORÁRIOS DE FUNCIONAMENTO ── */}
      {activeSettingsTab === "hours" && (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-lg font-black text-foreground">Horários de Atendimento</h2>
              <p className="text-xs text-muted-foreground">Defina os dias e intervalos em que seu estabelecimento está aberto</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const firstActive = workingDays.find(d => d.active);
                if (firstActive) {
                  const newDays = (Array.isArray(workingDays) ? workingDays : []).map(d => ({ ...d, start: firstActive.start, end: firstActive.end }));
                  setWorkingDays(newDays);
                  toast.success("Horário do primeiro dia copiado para todos!");
                }
              }}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              Copiar 1º Horário p/ Todos
            </button>
          </div>

          <div className="space-y-3">
            {workingDays.map((wd, idx) => (
              <div key={wd.day} className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-secondary/40 border border-border/50">
                <div className="flex items-center gap-3 w-32">
                  <input 
                    type="checkbox" 
                    id={`day-${idx}`}
                    checked={wd.active} 
                    onChange={(e) => updateWorkingDay(idx, 'active', e.target.checked)}
                    className="h-5 w-5 rounded border-border accent-primary cursor-pointer"
                  />
                  <label htmlFor={`day-${idx}`} className={cn("text-sm font-black cursor-pointer", wd.active ? "text-foreground" : "text-muted-foreground line-through")}>
                    {wd.day}
                  </label>
                </div>

                {wd.active ? (
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <input 
                      type="time" 
                      value={wd.start} 
                      onChange={(e) => updateWorkingDay(idx, 'start', e.target.value)}
                      className="h-10 px-3 rounded-xl border border-border bg-background outline-none font-bold text-xs"
                    />
                    <span className="text-muted-foreground text-xs font-bold">às</span>
                    <input 
                      type="time" 
                      value={wd.end} 
                      onChange={(e) => updateWorkingDay(idx, 'end', e.target.value)}
                      className="h-10 px-3 rounded-xl border border-border bg-background outline-none font-bold text-xs"
                    />
                  </div>
                ) : (
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Fechado</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: CONTATO & LOCALIZAÇÃO ── */}
      {activeSettingsTab === "location" && (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-in fade-in duration-200">
          <div className="border-b border-border/60 pb-4">
            <h2 className="text-lg font-black text-foreground">Contato e Localização</h2>
            <p className="text-xs text-muted-foreground">Informações de contato e coordenadas do mapa para entregadores</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">WhatsApp de Atendimento</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(66) 99999-9999"
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Endereço Completo</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade"
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm"
                />
              </div>
            </div>
          </div>

          {/* GPS Map Section */}
          <div className="p-6 bg-secondary/40 rounded-2xl border border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <Crosshair className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Localização Exata no Mapa (GPS)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {latitude && longitude 
                    ? `Marcado: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` 
                    : "Ponto ainda não selecionado no mapa"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMapFullscreen(true)}
              className="px-5 h-11 bg-foreground text-background hover:bg-primary hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0"
            >
              {latitude && longitude ? "Alterar no Mapa" : "Marcar no Mapa"}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 4: TAXAS DE ENTREGA ── */}
      {activeSettingsTab === "delivery" && (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-in fade-in duration-200">
          <div className="border-b border-border/60 pb-4">
            <h2 className="text-lg font-black text-foreground">Taxas e Regras de Entrega</h2>
            <p className="text-xs text-muted-foreground">Configure a taxa fixa ou os valores específicos cobrados por bairro</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setDeliveryMode("fixed_fee")}
              className={cn(
                "p-5 rounded-2xl border-2 text-left transition-all cursor-pointer",
                deliveryMode === "fixed_fee" 
                  ? "bg-primary/10 border-primary shadow-sm" 
                  : "bg-secondary/40 border-border hover:border-border/80"
              )}
            >
              <p className="font-black text-sm text-foreground">Taxa Única / Fixa</p>
              <p className="text-xs text-muted-foreground mt-1">O mesmo valor para qualquer entrega na cidade</p>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryMode("by_region")}
              className={cn(
                "p-5 rounded-2xl border-2 text-left transition-all cursor-pointer",
                deliveryMode === "by_region" 
                  ? "bg-primary/10 border-primary shadow-sm" 
                  : "bg-secondary/40 border-border hover:border-border/80"
              )}
            >
              <p className="font-black text-sm text-foreground">Por Bairros / Regiões</p>
              <p className="text-xs text-muted-foreground mt-1">Valor personalizado de acordo com o destino</p>
            </button>
          </div>

          {deliveryMode === "fixed_fee" ? (
            <div className="space-y-2 max-w-xs">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Valor da Taxa Fixa (R$)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">R$</span>
                <input
                  type="text"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-black text-base"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                <div>
                  <h3 className="text-sm font-black text-foreground">Tabela de Preços por Bairro / Região</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Os valores padrão do sistema já foram preenchidos como referência. Ajuste conforme necessário.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFillDefaultPrices}
                  className="px-4 py-2 bg-primary text-black font-black text-xs uppercase tracking-wider rounded-xl hover:scale-105 transition-all shadow-sm flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Restaurar Padrão do Admin
                </button>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {allRegions.map((region) => {
                  const defaultPrice = Number(region.price || 0).toFixed(2).replace(".", ",");
                  return (
                    <div key={region.id} className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-secondary/40 border border-border/50 hover:border-primary/30 transition-all">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-bold text-foreground block truncate">{region.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Valor Padrão (Admin): <strong className="text-primary font-black">R$ {defaultPrice}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-muted-foreground">R$</span>
                        <input
                          type="text"
                          value={getRegionPriceValue(region)}
                          onChange={(e) => handleRegionPriceChange(region.id, e.target.value)}
                          placeholder={defaultPrice}
                          className="w-28 h-10 px-3 rounded-xl border border-border bg-background text-right font-black text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: GALERIA DE FOTOS ── */}
      {activeSettingsTab === "gallery" && (
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h2 className="text-lg font-black text-foreground">Galeria de Fotos do Local</h2>
              <p className="text-xs text-muted-foreground">Fotos do espaço físico, pratos e ambiente</p>
            </div>
            <div>
              <input
                type="file"
                id="gallery-upload"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleGalleryUpload}
                disabled={isUploading}
              />
              <label
                htmlFor="gallery-upload"
                className="px-4 py-2.5 bg-foreground text-background hover:bg-primary hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar Fotos
              </label>
            </div>
          </div>

          {gallery.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-3 bg-secondary/20 rounded-2xl border border-dashed border-border">
              <ImagePlus className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm font-bold">Sua galeria ainda está vazia</p>
              <p className="text-xs">Adicione fotos para atrair mais clientes no marketplace.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {gallery.map((url, idx) => (
                <div key={idx} className="group relative aspect-square rounded-2xl overflow-hidden border border-border bg-muted shadow-sm">
                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <button
                    onClick={() => removeGalleryItem(url)}
                    className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-md"
                    title="Remover Foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 6: ZONA DE PERIGO (CONTA) ── */}
      {activeSettingsTab === "danger" && (
        <div className="bg-card border border-destructive/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4 text-destructive">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Zona de Perigo — Exclusão de Conta</h2>
              <p className="text-xs text-muted-foreground">Ações irreversíveis relacionadas à sua conta de lojista</p>
            </div>
          </div>

          <div className="bg-destructive/5 rounded-2xl p-5 border border-destructive/15 space-y-4">
            <p className="text-sm text-foreground/80 leading-relaxed font-medium">
              Ao excluir sua conta, todos os seus dados de estabelecimento, cardápio, produtos, histórico de vendas e configurações serão permanentemente removidos.
            </p>
            <button 
              onClick={async () => {
                if(confirm("Você tem certeza absoluta? Esta ação é irreversível. Todos os dados da sua empresa e acesso ao painel serão deletados imediatamente.")) {
                  try {
                    await deleteAccount();
                    toast.success("Conta excluída com sucesso.");
                  } catch {
                    toast.error("Não foi possível remover sua conta agora.");
                  }
                }
              }}
              className="px-6 h-12 rounded-xl bg-destructive hover:bg-destructive/90 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Excluir Minha Conta Permanentemente
            </button>
          </div>
        </div>
      )}

      {/* URL EDIT MODALS/OVERLAYS */}
      {(isEditingLogo || isEditingCover) && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 md:p-8 shadow-2xl space-y-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-black font-bold">
                       <Camera className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-black text-foreground">
                       {isEditingLogo ? "Alterar Logo" : "Alterar Imagem de Capa"}
                    </h3>
                 </div>
                 <button onClick={() => { setIsEditingLogo(false); setIsEditingCover(false); }} className="p-2 rounded-xl hover:bg-muted transition-colors cursor-pointer">
                    <X className="h-6 w-6" />
                 </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-muted-foreground font-medium">
                  Selecione uma imagem do seu celular ou computador (PNG, JPG até 5MB).
                </p>
                
                <input 
                  type="file" 
                  id="file-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, isEditingLogo ? 'logo' : 'cover')}
                  disabled={isUploading}
                />
                <label 
                  htmlFor="file-upload"
                  className={cn(
                    "w-full py-10 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-primary/10 transition-all",
                    isUploading && "opacity-50 cursor-not-allowed"
                  )}
                >
                   {isUploading ? (
                     <Loader2 className="h-10 w-10 animate-spin text-primary" />
                   ) : (
                     <ImagePlus className="h-10 w-10 text-primary" />
                   )}
                   <span className="text-xs font-black uppercase tracking-wider text-foreground">
                     {isUploading ? "Enviando arquivo..." : "Escolher Foto da Galeria"}
                   </span>
                </label>
              </div>

              <button 
                onClick={() => {
                   setIsEditingLogo(false);
                   setIsEditingCover(false);
                }}
                disabled={isUploading}
                className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-primary hover:text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                Concluir
              </button>
           </div>
        </div>,
        document.body
      )}

      {/* MAP MODAL */}
      {isMapFullscreen && createPortal(
         <div className="fixed inset-0 z-[200] bg-background animate-in fade-in duration-300 flex flex-col">
           <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between shadow-sm z-10 shrink-0">
             <div className="flex items-center gap-3">
               <button onClick={() => setIsMapFullscreen(false)} className="p-2 bg-muted rounded-xl hover:bg-muted/80 transition-colors cursor-pointer">
                 <X className="w-5 h-5 text-foreground" />
               </button>
               <div>
                 <h2 className="text-sm font-black text-foreground">Marcar Ponto da Loja no Mapa</h2>
               </div>
             </div>
             <button 
               onClick={handleSetLocation}
               className="px-5 h-10 bg-primary text-black font-black text-xs uppercase tracking-wider rounded-xl hover:scale-105 transition-all shadow-md cursor-pointer"
             >
               Confirmar Local
             </button>
           </div>
           
           <div className="flex-1 relative">
             <div ref={mapContainerRef} className="w-full h-full" />
             
             <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="relative flex flex-col items-center justify-center -mt-8">
                 <div className="bg-primary text-black text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-2 shadow-lg animate-bounce">
                   Local Exato
                 </div>
                 <Crosshair className="w-8 h-8 text-primary drop-shadow-md" />
                 <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shadow-lg" />
               </div>
             </div>
           </div>
         </div>,
         document.body
      )}
    </div>
  );
}
