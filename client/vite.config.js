import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // In development, /api and /health go to the local server (like nginx does in Docker).
    proxy: {
      "/api": process.env.API_UPSTREAM || "http://localhost:8000",
      "/health": process.env.API_UPSTREAM || "http://localhost:8000",
    },
  },
  // Pre-bundling breaks the path to onnxruntime's .wasm file in dev mode.
  optimizeDeps: { exclude: ["onnxruntime-web"] },
  build: { chunkSizeWarningLimit: 1500 },
});
