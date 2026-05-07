import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/invite/$token")({
  component: () => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-black">Convite recebido</h1>
        <p className="mt-2 text-muted-foreground">Cole seu token e crie a conta na página de login.</p>
        <a href="/login" className="mt-4 inline-block px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Ir para login</a>
      </div>
    </div>
  ),
});
