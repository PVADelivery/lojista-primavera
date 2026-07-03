import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const SUPABASE_URL = "https://owlbzwsdcognrgolvnzg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MWobbGmcE1EiYk5chbMUjg_7F5yFHXr";

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
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core"
      ]
    }
  };
});
