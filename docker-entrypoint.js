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

// Configurar headers para proxy reverso
app.set("trust proxy", true);
app.use((req, res, next) => {
  // Permitir o host do EasyPanel
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Outros headers necessários
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Configurar proxy para o backend
app.use(
  "/api",
  createProxyMiddleware({
    target: "http://localhost:8999",
    changeOrigin: true,
    pathRewrite: {
      "^/api": "",
    },
    onProxyReq: (proxyReq, req) => {
      // Log para debug
      console.log("📨 Proxy request:", {
        originalUrl: req.originalUrl,
        targetUrl: proxyReq.path,
        method: req.method,
        headers: req.headers,
      });
    },
    onProxyRes: (proxyRes, req) => {
      // Log para debug
      console.log("📨 Proxy response:", {
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers,
        originalUrl: req.originalUrl,
      });
    },
  })
);

// Servir arquivos estáticos do frontend
app.use(
  express.static(join(__dirname, "dist"), {
    // Configurações para cache e segurança
    maxAge: "1h",
    setHeaders: (res) => {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// Rota fallback para SPA
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando em http://0.0.0.0:${PORT}`);
  // Log das variáveis de ambiente importantes
  console.log("📝 Configurações:", {
    NODE_ENV: process.env.NODE_ENV,
    VIRTUAL_HOST: process.env.VIRTUAL_HOST,
    VIRTUAL_PORT: process.env.VIRTUAL_PORT,
  });
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
