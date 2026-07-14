import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Settings, Shield, Loader2, Save, Check, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/business/settings")({
  component: BusinessSettingsPage,
});

function BusinessSettingsPage() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || "");
          setPhone(data.phone || "");
          setDocument(""); // If document exists in profiles, map it
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone } as any)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Configurações salvas!");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar as configurações");
    }
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    const newPassword = prompt("Digite a nova senha (mínimo 8 caracteres):");
    if (!newPassword) return;
    if (newPassword.length < 8) {
      toast.error("Senha deve ter no mínimo 8 caracteres");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message || "Erro ao alterar a senha");
    } else {
      toast.success("Senha alterada com sucesso!");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div>
        <p className="label-tiny">Minha Conta</p>
        <h1 className="text-3xl font-black tracking-tight">Configurações</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile settings */}
        <div className="bg-card rounded-[2rem] p-6 shadow-card border border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Dados do Perfil</h3>
              <p className="text-sm text-muted-foreground">Informações pessoais da sua conta</p>
            </div>
          </div>
          <div className="space-y-4">
            <FieldInput label="Nome completo" value={fullName} onChange={setFullName} placeholder="Seu nome" />
            <FieldInput label="Email" value={user?.email || ""} onChange={() => {}} placeholder="" disabled />
            <FieldInput label="Telefone" value={phone} onChange={setPhone} placeholder="(00) 00000-0000" />
            <FieldInput label="Documento (CPF)" value={document} onChange={setDocument} placeholder="000.000.000-00" />
          </div>
          <div className="pt-6 mt-6 border-t border-border/50">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-black disabled:opacity-50 hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <Check className="h-5 w-5" /> : <Save className="h-5 w-5" />}
              {saved ? "Salvo com sucesso!" : "Salvar Alterações"}
            </button>
          </div>
        </div>

        {/* Security */}
        <div className="bg-card rounded-[2rem] p-6 shadow-card border border-border flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-warning" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">Segurança</h3>
              <p className="text-sm text-muted-foreground">Gerenciar senha e acesso</p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
             <div className="bg-muted/40 rounded-2xl p-6 text-center space-y-4 border border-border/50">
               <Shield className="h-10 w-10 text-muted-foreground/50 mx-auto" />
               <p className="text-sm text-muted-foreground">
                 Sua senha é pessoal e intransferível. Recomendamos usar uma senha forte e única para sua conta.
               </p>
             </div>
          </div>

          <div className="pt-6 mt-6 border-t border-border/50">
            <button
              onClick={handlePasswordChange}
              className="w-full px-4 py-3.5 rounded-xl border-2 border-border text-sm font-black hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              Alterar Senha de Acesso
            </button>
          </div>
        </div>
      </div>
      
      {/* ── BONASOFT Watermark ── */}
      <div className="mt-16 pb-8 flex justify-center opacity-40 select-none pointer-events-none">
        <span className="text-[10px] font-black tracking-[0.5em] text-muted-foreground uppercase">
          BONASOFT
        </span>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder, disabled, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted/50"
      />
    </div>
  );
}
