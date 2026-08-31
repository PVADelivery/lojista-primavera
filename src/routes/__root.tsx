import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import appCss from "../styles.css?url";

import { initializeGlobalErrorHandlers, reportErrorToTelegram } from "@/services/logger";
import { useEffect } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("Route Error:", error);
  const router = useRouter();

  useEffect(() => {
    reportErrorToTelegram({
      error_message: error?.message || "Erro na rota",
      stack_trace: error?.stack || "",
      url: window.location.href,
    }, "Painel do Lojista");
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground break-words">
          {error?.message ? `Erro: ${error.message}` : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        {error?.stack && (
          <pre className="mt-4 p-3 bg-muted/50 text-[10px] text-left overflow-auto max-h-40 rounded border border-border text-red-500 font-mono">
            {error.stack}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google", content: "notranslate" },
      { title: "MT 24horas express — Painel do Lojista" },
      { name: "description", content: "Gerencie pedidos, entregas, cardápio e clientes em um só lugar." },
      { property: "og:title", content: "MT 24horas express — Painel do Lojista" },
      { property: "og:description", content: "Gerencie pedidos, entregas, cardápio e clientes em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "MT 24horas express — Painel do Lojista" },
      { name: "twitter:description", content: "Gerencie pedidos, entregas, cardápio e clientes em um só lugar." },
      { property: "og:image", content: "https://lojista.mt24horasexpress.com/pwa-512x512-v3.png" },
      { name: "twitter:image", content: "https://lojista.mt24horasexpress.com/pwa-512x512-v3.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { useStoreNotifications } from "@/hooks/useStoreNotifications";

function StoreNotifications() {
  useStoreNotifications();
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initializeGlobalErrorHandlers("Painel do Lojista");
    if (typeof window !== "undefined" && window.location.hostname.includes("lovable.app")) {
      window.location.replace(`https://lojista.mt24horasexpress.com${window.location.pathname}${window.location.search}`);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <StoreNotifications />
          <Outlet />
          <Toaster richColors position="top-right" theme="system" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
