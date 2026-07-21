import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

import logoIcon from "@/assets/logo-icon-v3.png";



export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/business" });
  }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    if (error) toast.error(error.message);
    else toast.success("Bem-vindo(a)!");
    setBusy(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="hidden lg:flex flex-col justify-between p-12 bg-black text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 20% 30%, hsl(var(--primary)) 1px, transparent 1px), radial-gradient(circle at 70% 60%, hsl(var(--primary)) 1px, transparent 1px)", backgroundSize:"40px 40px"}} />
        <div className="relative flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-black flex items-center justify-center overflow-hidden ring-1 ring-primary/30"><img src={logoIcon} alt="MT 24horas express" className="h-12 w-12 object-contain"/></div>
          <span className="text-2xl font-black tracking-tight">MT 24horas express</span>
        </div>
        <div className="relative">
          <h1 className="text-5xl font-black leading-tight tracking-tight">
            Sua loja<br/>acelerada.
          </h1>
          <p className="mt-4 text-lg opacity-80 max-w-md font-medium">
            Pedidos, entregas, cardápio e clientes — tudo no mesmo painel.
          </p>
        </div>
        <p className="relative text-xs opacity-60 font-semibold">© MT 24horas express</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-black flex items-center justify-center overflow-hidden"><img src={logoIcon} alt="" className="h-9 w-9 object-contain"/></div>
            <span className="text-xl font-black">MT 24horas express</span>
          </div>

          <p className="label-tiny">Painel do Lojista</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Entrar na conta</h2>
          <p className="text-muted-foreground mt-2">
            Bom te ver de novo.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="em">E-mail</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Senha</Label>
              <div className="relative">
                <Input id="pw" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl h-12 pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full h-12 rounded-xl font-bold text-base">
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            Acesso exclusivo para lojistas parceiros.
          </p>
        </div>
      </div>
    </div>
  );
}
