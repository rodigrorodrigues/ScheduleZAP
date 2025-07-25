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
        target: "http://localhost:8999", // Backend local na VPS
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
