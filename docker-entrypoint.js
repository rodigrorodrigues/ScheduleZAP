import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar servidor Express para o frontend
const app = express();
const PORT = 8988;

// Iniciar o backend
console.log("🚀 Iniciando backend...");
const backend = spawn("node", ["backend/index.js"], {
  stdio: "inherit",
});

backend.on("error", (err) => {
  console.error("❌ Erro ao iniciar backend:", err);
  process.exit(1);
});

// Aguardar backend iniciar
await new Promise((resolve) => setTimeout(resolve, 2000));

// Configurar proxy para o backend
app.use(
  "/api",
  createProxyMiddleware({
    target: "http://localhost:8999",
    changeOrigin: true,
    pathRewrite: {
      "^/api": "",
    },
  })
);

// Servir arquivos estáticos do frontend
app.use(express.static(join(__dirname, "dist")));

// Rota fallback para SPA
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando em http://0.0.0.0:${PORT}`);
});

// Gerenciar processo
process.on("SIGTERM", () => {
  console.log("📥 Recebido sinal SIGTERM");
  backend.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("📥 Recebido sinal SIGINT");
  backend.kill("SIGINT");
  process.exit(0);
});

backend.on("exit", (code) => {
  console.log(`Backend encerrado com código ${code}`);
  process.exit(code);
});
