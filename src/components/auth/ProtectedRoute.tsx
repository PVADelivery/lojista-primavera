import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: "company" | "admin" | "driver" }) {
  const { user, loading, roles, userStatus, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading) return <Center text="Carregando..." />;
  if (!user) return <Center text="Redirecionando..." />;

  // Permissões removidas conforme solicitado
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
