import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "serve" ? "/admin/" : "/web/admin-dist/",
  root: "web/admin-src",
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: "../admin-dist",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "web/admin-src/index.html"),
      },
    },
  },
}));
