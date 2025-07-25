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
        target: "http://backend:8999", // nome do serviço backend no docker-compose
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
