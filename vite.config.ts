import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || "https://owlbzwsdcognrgolvnzg.supabase.co";
const RAW_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_JWT_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93bGJ6d3NkY29nbnJnb2x2bnpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5OTQ1NTMsImV4cCI6MjA5NTU3MDU1M30.R6-FUqubIr3uABzv1CS7jiS5cwygrNiIqk4oNbq7O44";
const SUPABASE_PUBLISHABLE_KEY = (!RAW_KEY || RAW_KEY.startsWith("sb_publishable_")) ? SUPABASE_JWT_ANON : RAW_KEY;

process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
process.env.VITE_SUPABASE_URL = SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
process.env.VITE_SUPABASE_PROJECT_ID = "owlbzwsdcognrgolvnzg";

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  
  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify("owlbzwsdcognrgolvnzg"),
      "process.env.SUPABASE_URL": JSON.stringify(SUPABASE_URL),
      "process.env.SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" }
      }),
      isBuild ? nitro({
        preset: process.env.NITRO_PRESET ?? "cloudflare-module",
        output: {
          dir: "dist",
          serverDir: "dist/server",
          publicDir: "dist/client"
        },
        cloudflare: { nodeCompat: true, deployConfig: true }
      }) : null,
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@capacitor/push-notifications": path.resolve(__dirname, "./src/lib/pushNotifications.ts"),
        "@capacitor/local-notifications": path.resolve(__dirname, "./src/lib/localNotifications.ts"),
        "@capacitor/app": path.resolve(__dirname, "./src/lib/capacitorApp.ts"),
        "@capacitor/status-bar": path.resolve(__dirname, "./src/lib/statusBarPlugin.ts"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core"
      ]
    },
    ssr: {
      external: [
        "@capacitor/core",
        "@capacitor/app",
        "@capacitor/status-bar",
        "@capacitor/push-notifications",
        "@capacitor/local-notifications"
      ]
    }
  };
});
