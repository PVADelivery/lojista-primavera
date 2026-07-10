import { useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: "company" | "admin" | "driver" }) {
  const { user, loading, roles, userStatus, hasRole, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isProfilePage = location.pathname.includes('/business/profile');

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (userStatus === "pending") navigate({ to: "/pending-approval" });
  }, [user, loading, userStatus, navigate]);

  if (loading) return <Center text="Carregando..." />;
  if (!user) return <Center text="Redirecionando..." />;
  if (!rolesLoaded) return <Center text="Verificando permissões..." />;
  
  if (roles.length === 0 && !isProfilePage) {
    // Adiciona um pequeno delay para evitar warnings do React durante o render
    setTimeout(() => {
      navigate({ to: "/business/profile" });
    }, 0);
    return <Center text="Preparando painel..." />;
  }

  if (userStatus === "rejected")
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-black">Acesso negado</h1>
          <p className="text-muted-foreground mt-2">Sua conta foi rejeitada.</p>
        </div>
      </div>
    );
  if (requiredRole && !hasRole(requiredRole) && !hasRole("admin") && !isProfilePage) {
    return <Center text="Sem permissão. Redirecionando..." />;
  }
  return <>{children}</>;
}

function Center({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold">{text}</p>
      </div>
    </div>
  );
}
