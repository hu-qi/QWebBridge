import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, existsSync, mkdirSync } from "fs";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "iife",
      },
    },
  },
  plugins: [
    {
      name: "copy-static",
      closeBundle() {
        const staticDir = resolve(__dirname, "static");
        const distDir = resolve(__dirname, "dist");
        if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
        copyFileSync(resolve(staticDir, "manifest.json"), resolve(distDir, "manifest.json"));
        copyFileSync(resolve(staticDir, "popup.html"), resolve(distDir, "popup.html"));
        copyFileSync(resolve(staticDir, "popup.js"), resolve(distDir, "popup.js"));
      },
    },
  ],
  resolve: {
    conditions: ["browser"],
  },
});
