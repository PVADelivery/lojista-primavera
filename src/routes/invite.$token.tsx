import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, User, Mail, Lock, Phone, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, Store, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: "",
    confirmPassword: "",
    phone: "",
    document: "",
    companyName: "",
    street: "",
    number: "",
    neighborhood: "",
    city: "Primavera do Leste - MT",
    complement: "",
    address: "",
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
        const { data, error: fetchError } = await (supabase as any).rpc("get_invitation_by_token", { _token: token });
        if (fetchError) throw fetchError;

        const inv = data as any;

        if (!inv || inv.status !== "pending") {
          setError("Este link de convite é inválido ou já foi utilizado.");
        } else {
          const expiresAt = new Date(inv.expires_at);
          if (expiresAt < new Date()) {
            setError("Este link de convite expirou.");
          } else {
            setInvitation(inv);
            // Pre-fill email
            setFormData(prev => ({ ...prev, email: inv.email || "" }));
          }
        }
      } catch (err: any) {
        console.error("Erro na validação:", err);
        setError("Erro ao validar convite: " + (err.message || "Permissão negada ou token inválido."));
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
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

    const fullAddress = formData.street 
      ? [
          `${formData.street.trim()}${formData.number ? `, ${formData.number.trim()}` : ''}`,
          formData.neighborhood ? `Bairro ${formData.neighborhood.trim()}` : '',
          formData.city ? formData.city.trim() : 'Primavera do Leste - MT',
          formData.complement ? `(${formData.complement.trim()})` : ''
        ].filter(Boolean).join(' - ')
      : formData.address || "Primavera do Leste - MT";

    try {
      // 1. Tentar aceitar convite via Edge Function
      const { data: result, error: invokeError } = await supabase.functions.invoke("accept-invitation", {
        body: {
          token,
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone,
          document: formData.document,
          companyName: formData.companyName,
          address: fullAddress,
        },
      });

      let registrationSuccess = false;

      if (!invokeError && result && !result.error) {
        registrationSuccess = true;
      } else {
        // Tentar extrair mensagem amigável de erro da Edge Function se houver
        let customMessage = "";
        if (invokeError && (invokeError as any).context) {
          try {
            const body = await (invokeError as any).context.json();
            if (body?.error) customMessage = body.error;
          } catch {}
        }

        if (customMessage) {
          throw new Error(customMessage);
        }

        // Fallback direto via Supabase Auth se Edge Function retornar erro genérico
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              phone: formData.phone,
            }
          }
        });

        if (signUpErr) {
          if (signUpErr.message?.toLowerCase().includes("already registered")) {
            throw new Error("Este e-mail já está cadastrado no sistema. Faça login diretamente.");
          }
          throw signUpErr;
        }

        const userId = signUpData.user?.id;
        if (userId) {
          await supabase.from("companies").insert({
            user_id: userId,
            name: formData.companyName || "Minha Loja",
            phone: formData.phone || null,
            document: formData.document || null,
            address: fullAddress,
            is_active: true,
            is_open: true,
          });

          await (supabase as any).from("invitations").update({ status: "accepted" }).eq("token", token);
          registrationSuccess = true;
        }
      }

      // Log in locally
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      toast.success("Bem-vindo! Seu cadastro foi finalizado com sucesso.");
      
      setTimeout(() => {
        navigate({ to: "/" });
      }, 1500);

    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      const errorMessage = err.message || "Erro ao realizar cadastro. Verifique os dados e tente novamente.";
      setFormError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const steps = ["Credenciais", "Dados da Loja", "Localização"];

  const nextStep = () => {
    if (step === 0 && (!formData.email || formData.password.length < 6 || formData.password !== formData.confirmPassword)) {
      toast.error("Preencha o email e uma senha válida de pelo menos 6 caracteres.");
      return;
    }
    
    if (step === 1) {
      if (!formData.companyName || !formData.fullName || !formData.phone || !formData.document) {
        toast.error("Preencha todos os dados da empresa.");
        return;
      }
    }

    setStep(s => Math.min(s + 1, 2));
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-xs font-black text-muted-foreground tracking-[0.2em] uppercase">Validando Convite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border shadow-2xl relative overflow-hidden">
          <CardHeader className="text-center pt-10">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-black">Link Inválido</CardTitle>
            <CardDescription className="mt-2">{error}</CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <Button className="w-full h-12 rounded-xl transition-all" onClick={() => navigate({ to: "/login" })}>
              Ir para o Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12 relative overflow-hidden">
      <div className="w-full max-w-xl relative z-10">
        <div className="flex items-center justify-between mb-8 px-2 relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -z-10" />
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-500 -z-10" 
            style={{ width: `${(step / 2) * 100}%` }} 
          />
          
          {steps.map((title, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div 
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 border ${
                  step > i ? 'bg-primary border-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)]' :
                  step === i ? 'bg-card border-primary text-primary shadow-[0_0_20px_rgba(var(--primary),0.2)]' :
                  'bg-card border-border text-muted-foreground'
                }`}
              >
                {step > i ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                step >= i ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {title}
              </span>
            </div>
          ))}
        </div>

        <Card className="border shadow-lg overflow-hidden rounded-3xl relative">
          <CardHeader className="text-center pb-6 pt-10">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 relative overflow-hidden">
              <Store className="h-10 w-10 text-primary relative z-10" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight mb-2">
              Cadastro de Loja
            </CardTitle>
            <CardDescription>
              {steps[step]}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            <div className="space-y-6">
              {formError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p>{formError}</p>
                </div>
              )}

              {/* STEP 0: CREDENCIAIS */}
              <div className={`space-y-5 transition-all duration-500 ${step === 0 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Email de Acesso</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="email"
                      className="pl-12 h-14 rounded-2xl text-base" 
                      placeholder="exemplo@email.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Criar Senha</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      type={showPassword ? "text" : "password"}
                      className="pl-12 pr-12 h-14 rounded-2xl text-base tracking-wider" 
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                    <button 
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Confirmar Senha</Label>
                  <div className="relative group">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      type={showConfirmPassword ? "text" : "password"}
                      className="pl-12 pr-12 h-14 rounded-2xl text-base tracking-wider" 
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                    <button 
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* STEP 1: DADOS EMPRESA */}
              <div className={`space-y-5 transition-all duration-500 ${step === 1 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Nome da Loja</Label>
                  <div className="relative group">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      className="pl-12 h-14 rounded-2xl text-base" 
                      placeholder="Nome Fantasia (ex: Lanchonete do Zé)"
                      value={formData.companyName}
                      onChange={e => setFormData({...formData, companyName: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                    Nome do Responsável
                  </Label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      className="pl-12 h-14 rounded-2xl text-base" 
                      placeholder="João da Silva"
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && nextStep()}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Telefone / WhatsApp</Label>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        className="pl-12 h-14 rounded-2xl text-base" 
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && nextStep()}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                      CNPJ / CPF
                    </Label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input 
                        className="pl-12 h-14 rounded-2xl text-base" 
                        placeholder="00.000.000/0001-00"
                        value={formData.document}
                        onChange={e => setFormData({...formData, document: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && nextStep()}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2: LOCALIZAÇÃO */}
              <div className={`space-y-5 transition-all duration-500 ${step === 2 ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Rua / Logradouro *</Label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      className="pl-12 h-14 rounded-2xl text-base" 
                      placeholder="Ex: Av. Brasil ou Rua das Flores"
                      value={formData.street}
                      onChange={e => setFormData({...formData, street: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Número *</Label>
                    <Input 
                      className="h-14 rounded-2xl text-base px-4" 
                      placeholder="Ex: 123 ou S/N"
                      value={formData.number}
                      onChange={e => setFormData({...formData, number: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Bairro *</Label>
                    <Input 
                      className="h-14 rounded-2xl text-base px-4" 
                      placeholder="Ex: Centro, Jardim Progresso..."
                      value={formData.neighborhood}
                      onChange={e => setFormData({...formData, neighborhood: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Cidade / Estado *</Label>
                    <Input 
                      className="h-14 rounded-2xl text-base px-4 bg-muted/30" 
                      placeholder="Primavera do Leste - MT"
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Complemento / Ref. (Opcional)</Label>
                    <Input 
                      className="h-14 rounded-2xl text-base px-4" 
                      placeholder="Ex: Ao lado do mercado, Apto 2..."
                      value={formData.complement}
                      onChange={e => setFormData({...formData, complement: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* NAVIGATION BUTTONS */}
              <div className="flex gap-4 pt-4">
                {step > 0 && (
                  <Button 
                    key="btn-prev"
                    type="button" 
                    variant="outline"
                    onClick={() => setStep(s => s - 1)}
                    className="h-14 px-6 rounded-2xl transition-all"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                
                {step < 2 ? (
                  <Button 
                    key="btn-next"
                    type="button" 
                    onClick={nextStep}
                    className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all group"
                  >
                    Próximo Passo
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                ) : (
                  <Button 
                    key="btn-submit"
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        Finalizar Cadastro
                        <CheckCircle2 className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
