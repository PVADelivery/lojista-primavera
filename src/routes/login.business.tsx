import { createFileRoute } from "@tanstack/react-router";
import logoIcon from "@/assets/logo-icon.png";

export const Route = createFileRoute("/login/business")({
  component: () => (
    <div className="min-h-screen flex items-center justify-center bg-black p-6">
      <div className="bg-card rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="h-20 w-20 mx-auto rounded-2xl bg-black flex items-center justify-center overflow-hidden ring-1 ring-primary/30">
          <img src={logoIcon} alt="Primavera Delivery" className="h-16 w-16 object-contain"/>
        </div>
        <h1 className="mt-4 text-2xl font-black">Primavera Delivery</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">Acesso Lojista</p>
        <p className="mt-2 text-muted-foreground">Use o login padrão por enquanto.</p>
        <a href="/login" className="mt-6 inline-block px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Ir para login</a>
      </div>
    </div>
  ),
});
