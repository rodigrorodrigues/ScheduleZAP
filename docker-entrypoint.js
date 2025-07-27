import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações básicas
const PORT = 8988;
const BACKEND_PORT = 8999;

// Configurar servidor Express
const app = express();

// Iniciar backend
console.log("🚀 Iniciando backend...");
const backend = spawn("node", ["backend/index.js"], {
  stdio: "inherit",
  env: { ...process.env, PORT: BACKEND_PORT.toString() },
});

// Configurar proxy para o backend
app.use(
  "/api",
  createProxyMiddleware({
    target: `http://localhost:${BACKEND_PORT}`,
    changeOrigin: true,
    pathRewrite: { "^/api": "" },
  })
);

// Servir arquivos estáticos
app.use(express.static(join(__dirname, "dist")));

// Rota fallback para SPA
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Tratamento básico de sinais
process.on("SIGTERM", () => process.exit());
process.on("SIGINT", () => process.exit());
