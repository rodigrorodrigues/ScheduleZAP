import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8988,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8999",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 8988,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
