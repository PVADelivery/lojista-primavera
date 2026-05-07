import { createFileRoute } from "@tanstack/react-router";
import { Sprout } from "lucide-react";

export const Route = createFileRoute("/login/business")({
  component: () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-info p-6">
      <div className="bg-card rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <Sprout className="h-12 w-12 mx-auto text-primary"/>
        <h1 className="mt-4 text-2xl font-black">Acesso Lojista</h1>
        <p className="mt-2 text-muted-foreground">Use o login padrão por enquanto.</p>
        <a href="/login" className="mt-6 inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Ir para login</a>
      </div>
    </div>
  ),
});
