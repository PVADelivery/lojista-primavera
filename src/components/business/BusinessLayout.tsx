import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Wallet, Users, History, Tag,
  Settings, LogOut, Bell, Search, Power, User as UserIcon,
  ChevronLeft, ChevronRight, HelpCircle, Smartphone, MapPin
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoIcon from "@/assets/logo-icon.png";


interface Company {
  id: string; name: string; logo_url: string | null; is_open: boolean;
}

const SIDE_ICONS = [
  { to: "/business", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/business/orders", label: "Pedidos", icon: ShoppingBag },
  { to: "/business/products", label: "Cardápio", icon: UtensilsCrossed },
  { to: "/business/coupons", label: "Cupons", icon: Tag },
  { to: "/business/customers", label: "Clientes", icon: Users },
  { to: "/business/finance", label: "Financeiro", icon: Wallet },
  { to: "/business/history", label: "Histórico", icon: History },
  { to: "/business/map", label: "Regiões", icon: MapPin },
];

const TOP_TABS = [
  { to: "/business", label: "Painel", exact: true },
  { to: "/business/orders", label: "Pedidos" },
  { to: "/business/products", label: "Cardápio" },
  { to: "/business/map", label: "Regiões" },
];

const MOBILE_NAV = [
  { to: "/business", label: "Painel", icon: LayoutDashboard, exact: true },
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
  const [historyIdx, setHistoryIdx] = useState(0);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  const { data: company } = useQuery({
    queryKey: ["my-company", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Company | null> => {
      const { data } = await supabase.from("companies").select("id,name,logo_url,is_open")
        .eq("user_id", user!.id).maybeSingle();
      if (!data) {
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* PREMIUM WIDE SIDEBAR WITH TOGGLE */}
        <aside 
          className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0 shadow-xl shadow-black/5 z-20 transition-all duration-300 relative ${
            isSidebarExpanded ? "w-64" : "w-20"
          }`}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="absolute -right-3.5 top-8 h-7 w-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform z-30"
            aria-label="Toggle Sidebar"
          >
            {isSidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* Logo & Brand */}
          <Link to="/business" className={`h-20 flex items-center gap-3 border-b border-sidebar-border/50 hover:bg-sidebar-accent/30 transition-colors ${isSidebarExpanded ? "px-6" : "px-0 justify-center"}`}>
            <div className="h-10 w-10 min-w-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20 p-1">
              <img src={logoIcon} alt="Primavera Delivery" className="h-full w-full object-contain filter brightness-0 invert" />
            </div>
            {isSidebarExpanded && (
              <div className="flex flex-col whitespace-nowrap overflow-hidden">
                <span translate="no" className="font-black text-base leading-tight tracking-tight text-sidebar-foreground">Primavera<br/>Delivery</span>
              </div>
            )}
          </Link>

          {/* Nav Links */}
          <nav className="flex-1 flex flex-col gap-1.5 p-4 overflow-y-auto overflow-x-hidden">
            {isSidebarExpanded && (
              <div className="text-[10px] font-bold text-sidebar-foreground/40 mb-2 uppercase tracking-wider px-2 whitespace-nowrap">Menu Principal</div>
            )}
            {SIDE_ICONS.map((it) => {
              const active = isActive(it.to, it.exact);
              return (
                <Tooltip key={it.to} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      to={it.to}
                      className={`relative h-12 flex items-center gap-3 transition-all group overflow-hidden ${
                        isSidebarExpanded ? "px-3 rounded-xl" : "justify-center rounded-xl mx-auto w-12"
                      } ${
                        active
                          ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                          : "text-sidebar-foreground/70 font-semibold hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      }`}
                    >
                      {/* Subtle active glow */}
                      {active && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />}
                      
                      <it.icon className={`h-5 w-5 min-w-5 ${active ? "text-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-primary transition-colors"}`} />
                      
                      {isSidebarExpanded && (
                        <span className="truncate whitespace-nowrap">{it.label}</span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {!isSidebarExpanded && <TooltipContent side="right" className="font-bold">{it.label}</TooltipContent>}
                </Tooltip>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-sidebar-border/50 flex flex-col gap-1 overflow-hidden">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link to="/business/profile" className={`h-11 flex items-center gap-3 text-sidebar-foreground/70 font-semibold hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors ${isSidebarExpanded ? "px-3 rounded-xl w-full" : "justify-center rounded-xl mx-auto w-11"}`}>
                  <Settings className="h-5 w-5 min-w-5 text-sidebar-foreground/50" />
                  {isSidebarExpanded && <span className="text-sm whitespace-nowrap">Configurações</span>}
                </Link>
              </TooltipTrigger>
              {!isSidebarExpanded && <TooltipContent side="right">Configurações</TooltipContent>}
            </Tooltip>

            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button onClick={() => signOut()} className={`h-11 flex items-center gap-3 text-sidebar-foreground/70 font-semibold hover:bg-destructive/10 hover:text-destructive transition-colors ${isSidebarExpanded ? "px-3 rounded-xl w-full" : "justify-center rounded-xl mx-auto w-11"}`}>
                  <LogOut className="h-5 w-5 min-w-5 text-sidebar-foreground/50 group-hover:text-destructive" />
                  {isSidebarExpanded && <span className="text-sm whitespace-nowrap">Sair do Painel</span>}
                </button>
              </TooltipTrigger>
              {!isSidebarExpanded && <TooltipContent side="right">Sair do Painel</TooltipContent>}
            </Tooltip>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* TOP BAR — Medal style with back/forward + tabs + right actions */}
          <header className="h-16 flex items-center px-3 lg:px-5 gap-2 bg-background border-b border-border flex-shrink-0">
            {/* Mobile menu / brand */}
            <div className="lg:hidden flex items-center gap-2 mr-2">
              <div className="h-9 w-9 rounded-xl bg-black flex items-center justify-center overflow-hidden">
                <img src={logoIcon} alt="Primavera Delivery" className="h-8 w-8 object-contain" />
              </div>
              <span className="font-black text-sm">Primavera Delivery</span>
            </div>


            {/* Back / Forward arrows */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => { window.history.back(); setHistoryIdx(historyIdx - 1); }}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => { window.history.forward(); setHistoryIdx(historyIdx + 1); }}
                className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition"
                aria-label="Avançar"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <nav className="hidden md:flex items-center gap-1 ml-2">
              {TOP_TABS.map((t) => {
                const active = isActive(t.to, t.exact);
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={`relative px-4 h-16 flex items-center text-sm font-bold transition ${
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    {active && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />}
                  </Link>
                );
              })}
            </nav>

            <div className="flex-1" />

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <button className="h-10 w-10 rounded-full bg-secondary hover:bg-accent/10 flex items-center justify-center transition" aria-label="Pesquisar">
                <Search className="h-4 w-4" />
              </button>

              {/* Store open/close */}
              <div className="hidden sm:flex items-center gap-2 px-3 h-10 rounded-full bg-secondary">
                <Power className={`h-4 w-4 ${company?.is_open ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-bold">{company?.is_open ? "Aberta" : "Fechada"}</span>
                <Switch checked={!!company?.is_open} onCheckedChange={toggleStore} />
              </div>

              {/* Theme toggle — sun/moon in circle */}
              <ThemeToggle />

              {/* Notifications */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative h-10 w-10 rounded-full bg-secondary hover:bg-accent/10 flex items-center justify-center transition" aria-label="Notificações">
                    <Bell className="h-4 w-4" />
                    {pendingOrders.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-black flex items-center justify-center border-2 border-background">
                        {pendingOrders.length}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-black text-sm">Notificações</p>
                    {pendingOrders.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{pendingOrders.length} novos</span>
                    )}
                  </div>
                  {pendingOrders.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Sem novas notificações
                    </div>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto">
                      {pendingOrders.map((o: any) => (
                        <li
                          key={o.id}
                          className="p-3 rounded-xl bg-secondary hover:bg-accent/10 cursor-pointer transition border-l-2 border-primary"
                          onClick={() => nav({ to: "/business/orders" })}
                        >
                          <p className="font-bold text-sm">Novo pedido — {o.customer_name ?? "Cliente"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">R$ {Number(o.total).toFixed(2)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </PopoverContent>
              </Popover>

              {/* Avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center font-black text-sm shadow-md hover:scale-105 transition">
                    {initials(profile?.full_name ?? company?.name)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 rounded-2xl">
                  <DropdownMenuLabel className="flex items-center gap-3 py-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center font-black">
                      {initials(profile?.full_name ?? company?.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{profile?.full_name ?? "Lojista"}</p>
                      <p className="text-xs text-muted-foreground truncate">{company?.name}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => nav({ to: "/business/profile" })}>
                    <UserIcon className="h-4 w-4 mr-2" /> Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav({ to: "/business/profile" })}>
                    <Settings className="h-4 w-4 mr-2" /> Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" /> Desconectar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
            {children ?? <Outlet />}
          </main>

          {/* Mobile bottom nav */}
          <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-30 bg-card/95 backdrop-blur-xl border border-border rounded-3xl shadow-2xl px-2 py-2 flex items-center justify-between">
            {MOBILE_NAV.map((it) => {
              const active = isActive(it.to, it.exact);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition ${
                    active ? "bg-primary text-primary-foreground scale-105" : "text-muted-foreground"
                  }`}
                >
                  <it.icon className="h-5 w-5" />
                  <span className="text-[10px] font-bold">{it.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
}
