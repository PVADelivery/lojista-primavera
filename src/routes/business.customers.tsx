import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, RefreshCw, User, Phone, ShoppingBag, Plus, X, Loader2, MapPin, Calendar, CreditCard, ChevronRight, Home, Briefcase, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CustomerRecord {
  id: string;
  name: string;
  phone?: string;
  cpf?: string;
  total_orders: number;
  last_order_at?: string;
  addresses: string[];
  phones: string[];
}

export const Route = createFileRoute("/business/customers")({
  component: BusinessCustomersPage,
});

function BusinessCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Modal de novo cliente
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", cpf: "" });
  const [addressEntries, setAddressEntries] = useState<{ label: string; address: string; reference: string }[]>([
    { label: "Casa", address: "", reference: "" },
  ]);

  const ADDRESS_LABELS = [
    { id: "Casa", icon: Home },
    { id: "Trabalho", icon: Briefcase },
    { id: "Casa da Mãe", icon: Heart },
    { id: "Outro", icon: MapPin },
  ];

  useEffect(() => {
    const init = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
        
        // Fallback para administradores
        if (!company) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile?.role === "admin") {
            const { data: fallbackCompany } = await supabase
              .from("companies")
              .select("id")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            company = fallbackCompany;
          }
        }

        if (company) setCompanyId(company.id);
        else setLoading(false);
      } catch (err) {
        console.error("Erro ao identificar empresa:", err);
        toast.error("Erro ao carregar empresa do lojista");
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const fetchCustomers = async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const customerMap = new Map<string, CustomerRecord>();

    const upsertCustomer = (source: any) => {
      const name = (source.name || source.customer_name || "").trim();
      const phone = source.phone || source.customer_phone || null;
      const cpf = source.cpf || source.customer_cpf || null;
      if (!name && !phone) return;

      const stableKey = source.customer_id || source.id || phone || name.toLowerCase();
      const id = String(stableKey);
      const existing = customerMap.get(id);
      const record: CustomerRecord = existing || {
        id,
        name: name || "Cliente",
        phone,
        cpf,
        total_orders: 0,
        last_order_at: undefined,
        addresses: [] as string[],
        phones: phone ? [phone] : ([] as string[])
      };

      record.total_orders += 1;
      if (name && record.name === "Cliente") record.name = name;
      if (phone && !record.phones.includes(phone)) record.phones.push(phone);
      if (!record.phone && phone) record.phone = phone;
      if (!record.cpf && cpf) record.cpf = cpf;
      if (source.address && !record.addresses.includes(source.address)) record.addresses.push(source.address);
      if (source.created_at && (!record.last_order_at || new Date(source.created_at) > new Date(record.last_order_at))) {
        record.last_order_at = source.created_at;
      }

      customerMap.set(id, record);
    };

    try {
      // 1. Busca entregas da empresa para extrair clientes reais
      const { data: dbDeliveries } = await supabase
        .from("deliveries")
        .select("id, customer_id, customer_name, customer_phone, customer_cpf, address, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      (dbDeliveries || []).forEach((d: any) => upsertCustomer(d));

      // 2. Busca pedidos (orders) da empresa para extrair clientes
      const { data: dbOrders } = await supabase
        .from("orders")
        .select("id, customer_name, customer_phone, delivery_address, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      (dbOrders || []).forEach((o: any) => {
        upsertCustomer({
          ...o,
          address: typeof o.delivery_address === "string" ? o.delivery_address : o.delivery_address?.street || ""
        });
      });

      // 3. Busca lista geral de cadastros na tabela customers
      const { data: dbCustomers } = await supabase
        .from("customers")
        .select("*")
        .limit(100);

      (dbCustomers || []).forEach((c: any) => {
        upsertCustomer({
          id: c.id,
          name: c.name,
          phone: c.phone,
          cpf: c.cpf,
          created_at: c.created_at,
          address: "",
        });
      });

      setCustomers(Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) {
      console.error("Erro ao carregar clientes:", err);
      toast.error(err?.message || "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchCustomers();
  }, [companyId]);

  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);

  const openNewModal = () => {
    setEditingCustomer(null);
    setForm({ name: "", phone: "", cpf: "" });
    setAddressEntries([{ label: "Casa", address: "", reference: "" }]);
    setShowNewModal(true);
  };

  const openEditModal = (cust: CustomerRecord) => {
    setEditingCustomer(cust);
    setForm({
      name: cust.name || "",
      phone: cust.phone || "",
      cpf: cust.cpf || "",
    });
    setAddressEntries(
      cust.addresses.length > 0
        ? cust.addresses.map(a => ({ label: "Casa", address: a, reference: "" }))
        : [{ label: "Casa", address: "", reference: "" }]
    );
    setShowNewModal(true);
  };

  const handleDelete = async (cust: CustomerRecord) => {
    if (!confirm(`Deseja realmente remover o cliente "${cust.name}"?`)) return;

    try {
      if (cust.id && !cust.id.startsWith("0") && cust.id.includes("-")) {
        const { error } = await supabase.from("customers").delete().eq("id", cust.id);
        if (error) console.warn("Erro ao deletar da tabela de clientes:", error.message);
      }

      setCustomers(prev => prev.filter(c => c.id !== cust.id));
      if (selectedCustomer?.id === cust.id) setSelectedCustomer(null);
      toast.success("Cliente removido com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir cliente");
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setSaving(true);

    try {
      if (editingCustomer && editingCustomer.id.includes("-")) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            cpf: form.cpf.trim() || null,
          })
          .eq("id", editingCustomer.id);

        if (error) throw error;

        setCustomers(prev =>
          prev.map(c =>
            c.id === editingCustomer.id
              ? {
                  ...c,
                  name: form.name.trim(),
                  phone: form.phone.trim() || undefined,
                  cpf: form.cpf.trim() || undefined,
                  addresses: addressEntries.filter(a => a.address.trim()).map(a => a.address.trim()),
                }
              : c
          )
        );
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { data: customer, error } = await supabase
          .from("customers")
          .insert({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            cpf: form.cpf.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;

        const validAddresses = addressEntries.filter((a) => a.address.trim());
        const savedAddressStrings: string[] = validAddresses.map((a) => a.address.trim());

        if (validAddresses.length && customer?.id) {
          const rows = validAddresses.map((a) => ({
            customer_id: customer.id,
            street: a.address.trim(),
            label: a.label,
          }));
          await supabase.from("addresses").insert(rows).catch(() => {});
        }

        toast.success("Cliente cadastrado com sucesso!");
        setCustomers((prev) => [
          {
            id: customer?.id || crypto.randomUUID(),
            name: form.name.trim(),
            phone: form.phone.trim() || undefined,
            cpf: form.cpf.trim() || undefined,
            total_orders: 0,
            last_order_at: undefined,
            addresses: savedAddressStrings,
            phones: form.phone.trim() ? [form.phone.trim()] : [],
          },
          ...prev,
        ]);
      }

      setShowNewModal(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.cpf && c.cpf.includes(searchTerm))
  );

  if (loading) return (
    <div className="flex items-center justify-center py-24"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-2xl font-black text-foreground">Sua Freguesia</h2>
          <p className="text-muted-foreground text-sm font-medium">
            Gerencie sua carteira de clientes ({customers.length} cadastrados).
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, fone ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-card text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
            />
          </div>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-card whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <th className="py-3.5 px-5">Cliente</th>
                <th className="py-3.5 px-4">Telefone / CPF</th>
                <th className="py-3.5 px-4">Endereço Principal</th>
                <th className="py-3.5 px-4 text-center">Pedidos</th>
                <th className="py-3.5 px-4">Último Pedido</th>
                <th className="py-3.5 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 font-medium">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="font-bold text-foreground">Nenhum cliente encontrado</p>
                    <p className="text-xs mt-1">Tente buscar por outro termo ou cadastre um novo cliente.</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          {customer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {customer.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col leading-tight">
                        <span className="text-foreground font-semibold flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" /> {customer.phone || "---"}
                        </span>
                        {customer.cpf && <span className="text-[11px] text-muted-foreground">CPF: {customer.cpf}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate">
                      {customer.addresses.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{customer.addresses[0]}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">Sem endereço registrado</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-primary/10 text-primary font-black text-xs">
                        {customer.total_orders}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-muted-foreground font-medium">
                      {customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString() : "---"}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="p-2 rounded-xl bg-secondary hover:bg-primary/10 hover:text-primary transition-all"
                          title="Ver Detalhes"
                        >
                          <ShoppingBag className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(customer)}
                          className="p-2 rounded-xl bg-secondary hover:bg-amber-500/10 hover:text-amber-600 transition-all"
                          title="Editar Cliente"
                        >
                          <User className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          className="p-2 rounded-xl bg-secondary hover:bg-destructive/10 hover:text-destructive transition-all"
                          title="Excluir Cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => !saving && setShowNewModal(false)}
        >
          <div
            className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-md p-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-foreground">
                  {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  {editingCustomer ? "Altere as informações abaixo." : "Cadastre um cliente manualmente."}
                </p>
              </div>
              <button
                onClick={() => !saving && setShowNewModal(false)}
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                disabled={saving}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nome *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Maria Silva"
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Telefone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">CPF</label>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="mt-1.5 w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  maxLength={14}
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Endereço Principal
                  </label>
                </div>

                {addressEntries.map((entry, idx) => (
                  <div key={idx} className="p-3 rounded-2xl border border-border bg-muted/20 space-y-2">
                    <input
                      type="text"
                      value={entry.address}
                      onChange={(e) =>
                        setAddressEntries((prev) =>
                          prev.map((a, i) => (i === idx ? { ...a, address: e.target.value } : a))
                        )
                      }
                      placeholder="Rua, Número - Bairro"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-xs focus:border-primary outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl border border-border hover:bg-muted text-sm font-bold text-muted-foreground transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setSelectedCustomer(null)}
        >
          <div 
            className="w-full max-w-lg h-full bg-background shadow-2xl border-l border-border animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 pb-24">
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </button>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Ficha do Cliente</span>
              </div>

              <div className="flex items-center gap-6 mb-12">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <User className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-foreground tracking-tighter">{selectedCustomer.name}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-success/10 text-success uppercase tracking-wider">Ativo</span>
                    <span className="text-xs font-medium text-muted-foreground">{selectedCustomer.total_orders} pedidos realizados</span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Informações de Contato</h4>
                  <div className="space-y-3">
                    {selectedCustomer.phones.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                        <Phone className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">{p}</span>
                      </div>
                    ))}
                    {selectedCustomer.cpf && (
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">CPF: {selectedCustomer.cpf}</span>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Endereços de Entrega</h4>
                  <div className="space-y-3">
                    {selectedCustomer.addresses.map((addr, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border">
                        <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm font-medium text-muted-foreground leading-relaxed">{addr}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Última Atividade</h4>
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-foreground">Último Pedido</p>
                        <p className="text-xs text-muted-foreground">Realizado em {selectedCustomer.last_order_at ? new Date(selectedCustomer.last_order_at).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-12 pt-8 border-t border-border flex gap-3">
                <button 
                  onClick={() => openEditModal(selectedCustomer)}
                  className="flex-1 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg"
                >
                  Editar Cliente
                </button>
                <button 
                  onClick={() => handleDelete(selectedCustomer)}
                  className="px-6 py-4 rounded-2xl bg-destructive/10 text-destructive font-black text-xs uppercase tracking-widest hover:bg-destructive/20 transition-all"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
