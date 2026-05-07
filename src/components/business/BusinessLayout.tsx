import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Wallet, Users, History, Tag,
  Settings, LogOut, Menu, X, Bell, ChevronLeft, Sprout, Power, User as UserIcon
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { initials } from "@/lib/format";

interface Company {
  id: string; name: string; logo_url: string | null; is_open: boolean;
}

const NAV = [
  { group: "Operacional", items: [
    { to: "/business", label: "Painel de Entregas", icon: LayoutDashboard, exact: true },
    { to: "/business/orders", label: "Novos Pedidos", icon: ShoppingBag },
  ]},
  { group: "Marketplace", items: [
    { to: "/business/products", label: "Cardápio", icon: UtensilsCrossed },
    { to: "/business/coupons", label: "Cupons", icon: Tag },
    { to: "/business/customers", label: "Meus Clientes", icon: Users },
  ]},
  { group: "Gestão", items: [
    { to: "/business/finance", label: "Financeiro", icon: Wallet },
    { to: "/business/history", label: "Histórico", icon: History },
  ]},
  { group: "Configurações", items: [
    { to: "/business/profile", label: "Identidade Visual", icon: Settings },
  ]},
];

const MOBILE_NAV = [
  { to: "/business", label: "Entregas", icon: LayoutDashboard, exact: true },
  { to: "/business/orders", label: "Pedidos", icon: ShoppingBag },
  { to: "/business/products", label: "Cardápio", icon: UtensilsCrossed },
  { to: "/business/finance", label: "Finanças", icon: Wallet },
  { to: "/business/profile", label: "Perfil", icon: UserIcon },
];

export function BusinessLayout({ children }: { children?: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("sb-collapsed") === "1" : false
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { localStorage.setItem("sb-collapsed", collapsed ? "1" : "0"); }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  const { data: company } = useQuery({
    queryKey: ["my-company", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Company | null> => {
      const { data } = await supabase.from("companies").select("id,name,logo_url,is_open")
        .eq("user_id", user!.id).maybeSingle();
      if (!data) {
        // create default
        const { data: c } = await supabase.from("companies")
          .insert({ user_id: user!.id, name: profile?.full_name ?? "Minha Loja" })
          .select("id,name,logo_url,is_open").single();
        return c as Company;
      }
      return data as Company;
    },
  });

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["pending-orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id,customer_name,total,created_at")
        .eq("company_id", company!.id).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // realtime
  useEffect(() => {
    if (!company?.id) return;
    const ch = supabase.channel(`co-${company.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${company.id}` },
        () => { qc.invalidateQueries({ queryKey: ["pending-orders"] }); qc.invalidateQueries({ queryKey: ["orders"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `company_id=eq.${company.id}` },
        () => qc.invalidateQueries({ queryKey: ["deliveries"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [company?.id, qc]);

  const toggleStore = async (open: boolean) => {
    if (!company) return;
    await supabase.from("companies").update({ is_open: open }).eq("id", company.id);
    qc.invalidateQueries({ queryKey: ["my-company"] });
    toast.success(open ? "Loja aberta — recebendo pedidos" : "Loja fechada");
  };

  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");

  const title = (() => {
    const all = NAV.flatMap(g => g.items);
    return all.find(i => isActive(i.to, i.exact))?.label ?? "Painel";
  })();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ${collapsed ? "w-20" : "w-72"} relative`}>
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-8 z-10 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}/>
        </button>
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-lg">
            {company?.logo_url ? <img src={company.logo_url} alt="" className="h-full w-full rounded-2xl object-cover"/> : <Sprout className="h-6 w-6"/>}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="label-tiny">Loja</p>
              <p className="font-black text-sm truncate">{company?.name ?? "..."}</p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {NAV.map((g) => (
            <div key={g.group}>
              {!collapsed && <p className="label-tiny px-3 mb-2">{g.group}</p>}
              <ul className="space-y-1">
                {g.items.map((it) => (
                  <li key={it.to}>
                    <Link to={it.to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${isActive(it.to, it.exact) ? "bg-primary text-primary-foreground shadow-lg" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                      <it.icon className="h-5 w-5 flex-shrink-0"/>
                      {!collapsed && <span>{it.label}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-destructive/10 text-destructive">
            <LogOut className="h-5 w-5"/>
            {!collapsed && "Sair"}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="font-black">{company?.name}</span>
              <button onClick={() => setMobileOpen(false)}><X className="h-6 w-6"/></button>
            </div>
            {NAV.flatMap(g => g.items).map((it) => (
              <Link key={it.to} to={it.to} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${isActive(it.to, it.exact) ? "bg-primary text-primary-foreground" : ""}`}>
                <it.icon className="h-5 w-5"/>{it.label}
              </Link>
            ))}
            <button onClick={signOut} className="mt-4 w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-destructive">
              <LogOut className="h-5 w-5"/>Sair
            </button>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border h-16 flex items-center px-4 lg:px-8 gap-4">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-6 w-6"/></button>
          <div className="flex-1 min-w-0">
            <p className="label-tiny">Primavera Delivery</p>
            <h1 className="font-black text-lg truncate">{title}</h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary">
            <Power className={`h-4 w-4 ${company?.is_open ? "text-success" : "text-muted-foreground"}`} />
            <span className="text-xs font-bold">{company?.is_open ? "Aberta" : "Fechada"}</span>
            <Switch checked={!!company?.is_open} onCheckedChange={toggleStore} />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative p-2 rounded-xl hover:bg-secondary">
                <Bell className="h-5 w-5"/>
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-black flex items-center justify-center">{pendingOrders.length}</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 rounded-2xl">
              <p className="label-tiny mb-2">Novos pedidos</p>
              {pendingOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sem novos pedidos</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto">
                  {pendingOrders.map((o: any) => (
                    <li key={o.id} className="p-3 rounded-xl bg-secondary cursor-pointer hover:bg-secondary/70" onClick={() => nav({ to: "/business/orders" })}>
                      <p className="font-bold text-sm">{o.customer_name ?? "Cliente"}</p>
                      <p className="text-xs text-muted-foreground">R$ {Number(o.total).toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">
              {initials(profile?.full_name)}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">{children ?? <Outlet />}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-4 left-4 right-4 z-30 bg-card/90 backdrop-blur-xl border border-border rounded-3xl shadow-2xl px-2 py-2 flex items-center justify-between">
          {MOBILE_NAV.map((it) => {
            const active = isActive(it.to, it.exact);
            return (
              <Link key={it.to} to={it.to} className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition ${active ? "bg-primary text-primary-foreground scale-110" : "text-muted-foreground"}`}>
                <it.icon className="h-5 w-5"/>
                <span className="text-[10px] font-bold">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
