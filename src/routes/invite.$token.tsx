import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, Store, Mail, Lock, Phone, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    document: "", // CNPJ
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Token não fornecido");
        setValidating(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("invitations")
          .select("status, expires_at, email")
          .eq("token", token)
          .maybeSingle();

        if (fetchError) throw new Error(fetchError.message);

        if (!data || data.status === 'accepted') {
          setError("Este link de convite é inválido ou já foi utilizado.");
        } else {
          const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
          if (expiresAt && expiresAt < new Date()) {
            setError("Este link de convite expirou.");
          } else {
            if (data.email) {
              setFormData(prev => ({ ...prev, email: data.email }));
            }
          }
        }
      } catch (err: any) {
        console.error("Erro na validação:", err);
        setError("Erro ao validar convite: " + err.message);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    
    if (step < 1) {
      nextStep();
      return;
    }

    if (loading) return;
    
    setLoading(true);
    setFormError(null);
    if (formData.password !== formData.confirmPassword) {
      setFormError("As senhas não coincidem.");
      toast.error("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.companyName, // Usando o full_name do usuário para o nome do gestor ou empresa inicial
            phone: formData.phone,
          }
        }
      });

      if (authError) throw authError;
      
      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("Não foi possível criar sua conta. Verifique se este email já está em uso.");
      }

      // Finalizar cadastro no banco
      await supabase.from("user_roles").upsert({ user_id: userId, role: "company" }, { onConflict: "user_id" });
      await supabase.from("companies").insert({ 
        user_id: userId, 
        name: formData.companyName,
        phone: formData.phone,
        full_name: formData.document, // Usando full_name para salvar o CNPJ por enquanto
      });
      await supabase.from("invitations").update({ status: 'accepted' }).eq("token", token);

      toast.success("Bem-vindo! Cadastro finalizado com sucesso.");
      
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 2000);

    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      const errorMessage = err.message || "Erro ao realizar cadastro. Tente novamente.";
      setFormError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const steps = ["Credenciais", "Dados da Loja"];

  const nextStep = () => {
    if (step === 0 && (!formData.email || formData.password.length < 6 || formData.password !== formData.confirmPassword)) {
      toast.error("Preencha o email e uma senha válida de pelo menos 6 caracteres.");
      return;
    }
    if (step === 1 && (!formData.companyName || !formData.phone)) {
      toast.error("Preencha todos os dados da loja.");
      return;
    }
    setStep(s => Math.min(s + 1, 1));
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse" />
            <div className="h-16 w-16 bg-card border border-border rounded-2xl flex items-center justify-center relative z-10 shadow-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <p className="text-sm font-bold text-muted-foreground tracking-[0.2em] uppercase">Validando Convite</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.1),transparent_50%)]" />
        <Card className="w-full max-w-md border-destructive/20 bg-card/80 backdrop-blur-xl shadow-2xl z-10">
          <CardHeader className="text-center pt-10">
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6 shadow-inner ring-1 ring-destructive/20">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-3xl font-black text-foreground">Convite Inválido</CardTitle>
            <CardDescription className="text-muted-foreground text-base mt-3 leading-relaxed">{error}</CardDescription>
          </CardHeader>
          <CardContent className="pb-10">
            <Button className="w-full h-14 rounded-2xl text-base font-bold transition-all hover:scale-[1.02]" variant="secondary" onClick={() => navigate({ to: "/login" })}>
              Voltar para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_70%)]" />
      
      <Card className="w-full max-w-xl border-border bg-card/80 backdrop-blur-2xl shadow-2xl relative z-10 rounded-3xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.5)]" />
        
        <CardHeader className="text-center pb-6 pt-12 px-8">
          <div className="mx-auto w-24 h-24 rounded-[2rem] bg-primary/10 flex items-center justify-center mb-6 shadow-inner ring-1 ring-primary/20 relative group">
            <div className="absolute inset-0 rounded-[2rem] bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Store className="h-12 w-12 text-primary relative z-10" />
          </div>
          <CardTitle className="text-4xl font-black tracking-tight text-foreground mb-3">Bem-vindo, Lojista!</CardTitle>
          <CardDescription className="text-muted-foreground text-base font-medium">
            Complete o cadastro do seu estabelecimento.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-12">
          
          {/* Progress Steps */}
          <div className="flex items-center gap-3 mb-10">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-500 ${i <= step ? "bg-primary text-primary-foreground shadow-lg scale-110" : "bg-secondary text-muted-foreground border border-border"}`}>
                  {i + 1}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.15em] hidden sm:block transition-colors duration-300 ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                  {s}
                </span>
                {i < steps.length - 1 && <div className={`flex-1 h-1 rounded-full transition-colors duration-500 ${i < step ? "bg-primary shadow-sm" : "bg-secondary"}`} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {formError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <div className="min-h-[220px]">
              {step === 0 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-forwards">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">E-mail de Acesso</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="email"
                        className="pl-12 h-14 rounded-2xl bg-secondary/50 border-border text-foreground text-base focus:bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground" 
                        placeholder="loja@email.com"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nextStep(); } }}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Criar Senha</Label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                          type={showPassword ? "text" : "password"}
                          className="pl-12 pr-12 h-14 rounded-2xl bg-secondary/50 border-border text-foreground text-base focus:bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground" 
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={e => setFormData({...formData, password: e.target.value})}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nextStep(); } }}
                          required
                          minLength={6}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Confirmar Senha</Label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                          type={showConfirmPassword ? "text" : "password"}
                          className="pl-12 pr-12 h-14 rounded-2xl bg-secondary/50 border-border text-foreground text-base focus:bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground" 
                          placeholder="••••••••"
                          value={formData.confirmPassword}
                          onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nextStep(); } }}
                          required
                          minLength={6}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-500 fill-mode-forwards">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Nome do Estabelecimento</Label>
                    <div className="relative group">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        className="pl-12 h-14 rounded-2xl bg-secondary/50 border-border text-foreground text-base focus:bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground" 
                        placeholder="Minha Loja Delivery"
                        value={formData.companyName}
                        onChange={e => setFormData({...formData, companyName: e.target.value})}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">Telefone / WhatsApp</Label>
                      <div className="relative group">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                          className="pl-12 h-14 rounded-2xl bg-secondary/50 border-border text-foreground text-base focus:bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground" 
                          placeholder="(00) 90000-0000"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground ml-1">CNPJ (Opcional)</Label>
                      <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input 
                          className="pl-12 h-14 rounded-2xl bg-secondary/50 border-border text-foreground text-base focus:bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground" 
                          placeholder="00.000.000/0000-00"
                          value={formData.document}
                          onChange={e => setFormData({...formData, document: e.target.value})}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="flex gap-4 pt-4 mt-2">
              {step > 0 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-14 px-6 rounded-2xl font-bold bg-transparent border-border text-foreground hover:bg-secondary transition-all" 
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft className="h-5 w-5 mr-2" /> Voltar
                </Button>
              )}
              
              {step < 1 ? (
                <Button 
                  key="btn-next"
                  type="button" 
                  className="flex-1 h-14 rounded-2xl font-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground" 
                  onClick={nextStep}
                >
                  Continuar <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              ) : (
                <Button 
                  key="btn-submit"
                  type="button" 
                  onClick={handleSubmit}
                  className="flex-1 h-14 rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all bg-primary text-primary-foreground relative overflow-hidden group" 
                  disabled={loading}
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                  {loading ? (
                    <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processando...</>
                  ) : (
                    <><CheckCircle2 className="h-5 w-5 mr-2" /> Finalizar Cadastro</>
                  )}
                </Button>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
