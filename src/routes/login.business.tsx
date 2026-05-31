import { createFileRoute } from "@tanstack/react-router";
import logoFull from "@/assets/logo-full.png";

export const Route = createFileRoute("/login/business")({
  component: () => (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="bg-card rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <img src={logoFull} alt="Primavera Delivery" className="h-20 mx-auto object-contain"/>
        <h1 className="mt-4 text-2xl font-black">Acesso Lojista</h1>
        <p className="mt-2 text-muted-foreground">Use o login padrão por enquanto.</p>
        <a href="/login" className="mt-6 inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Ir para login</a>
      </div>
    </div>
  ),
});
