// Vercel-specific Vite config.
// Uses @tanstack/react-start/config directly — intentionally excludes
// @cloudflare/vite-plugin (Lovable/Cloudflare-only) and Lovable dev tooling
// (component tagger, HMR gate, sandbox detection) that must not run on Vercel.
//
// All data-fetching is client-side via Supabase SDK (no createServerFn usage),
// so a static public bundle (.output/public/) is sufficient — no serverless
// function layer needed.
import { defineConfig } from "@tanstack/react-start/config";
import tailwindcss from "@tailwindcss/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  vite: {
    plugins: [tailwindcss(), viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
    resolve: {
      alias: { "@": "/src" },
    },
  },
});
