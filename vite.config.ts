import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente baseado no modo
  const env = loadEnv(mode, process.cwd(), "");
  const host =
    process.env.VIRTUAL_HOST || "evolution-schedulezap.jqzthr.easypanel.host";

  return {
    plugins: [react()],
    server: {
      port: 8988,
      host: true,
      proxy: {
        "/api": {
          target: "http://localhost:8999",
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    preview: {
      port: 8988,
      host: true,
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      // Configurações para produção
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
          },
        },
      },
    },
  };
});
