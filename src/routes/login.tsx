import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

import logoIcon from "@/assets/logo-icon.png";



export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/business" });
  }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "login") {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
      else toast.success("Bem-vindo(a)!");
    } else {
      const { error } = await signUp(email, password, fullName);
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Verifique seu e-mail.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="hidden lg:flex flex-col justify-between p-12 bg-black text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 20% 30%, hsl(var(--primary)) 1px, transparent 1px), radial-gradient(circle at 70% 60%, hsl(var(--primary)) 1px, transparent 1px)", backgroundSize:"40px 40px"}} />
        <div className="relative">
          <img src={logoFull} alt="Primavera Delivery" className="h-20 w-auto object-contain" />
        </div>
        <div className="relative">
          <h1 className="text-5xl font-black leading-tight tracking-tight">
            Sua loja<br/>acelerada.
          </h1>
          <p className="mt-4 text-lg opacity-80 max-w-md font-medium">
            Pedidos, entregas, cardápio e clientes — tudo no mesmo painel.
          </p>
        </div>
        <p className="relative text-xs opacity-60 font-semibold">© Primavera Delivery</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center overflow-hidden"><img src={logoIcon} alt="" className="h-9 w-9 object-contain"/></div>
            <span className="text-xl font-black">Primavera</span>
          </div>

          <p className="label-tiny">Painel do Lojista</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">{mode === "login" ? "Entrar na conta" : "Criar conta"}</h2>
          <p className="text-muted-foreground mt-2">
            {mode === "login" ? "Bom te ver de novo." : "Comece a receber pedidos hoje."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fn">Nome completo</Label>
                <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="rounded-xl h-12" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="em">E-mail</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Senha</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl h-12" />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl font-bold text-base">
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-bold hover:underline">
              {mode === "login" ? "Criar uma" : "Entrar"}
            </button>
          </p>
          <p className="mt-3 text-xs text-center text-muted-foreground">
            <Link to="/login/business" className="hover:underline">Acesso de lojista parceiro →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
