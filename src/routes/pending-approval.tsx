import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/pending-approval")({
  component: () => {
    const { signOut } = useAuth();
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center bg-card rounded-3xl p-10 shadow-card">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-warning/10 text-warning flex items-center justify-center">
            <Clock className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-2xl font-black">Aguardando aprovação</h1>
          <p className="mt-2 text-muted-foreground">Sua conta está em análise pela equipe Primavera. Avisaremos por e-mail.</p>
          <button onClick={signOut} className="mt-6 px-5 py-3 rounded-xl border border-border font-bold text-sm">Sair</button>
        </div>
      </div>
    );
  },
});
