import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Instance build flags live beside the server settings in the repository-root
  // .env. Vite exposes only VITE_* values to the client bundle.
  envDir: path.resolve(import.meta.dirname),
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    // The public artifact must contain only the current release boundary. Keeping
    // old hashed chunks would leave removed card implementations publicly fetchable.
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
