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
const BACKEND_PORT = 8999;

// Log de configuração inicial
console.log("📝 Configuração inicial:", {
  NODE_ENV: process.env.NODE_ENV,
  VIRTUAL_HOST: process.env.VIRTUAL_HOST,
  VIRTUAL_PORT: process.env.VIRTUAL_PORT,
  PORT: PORT,
  BACKEND_PORT: BACKEND_PORT,
});

// Iniciar o backend
console.log("🚀 Iniciando backend...");
const backend = spawn("node", ["backend/index.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: BACKEND_PORT.toString(),
  },
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
  // Log da requisição
  console.log("📥 Requisição recebida:", {
    method: req.method,
    url: req.url,
    headers: req.headers,
    ip: req.ip,
    protocol: req.protocol,
  });

  // Headers CORS e segurança
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Responder imediatamente a requisições OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Configurar proxy para o backend
app.use(
  "/api",
  createProxyMiddleware({
    target: `http://localhost:${BACKEND_PORT}`,
    changeOrigin: true,
    pathRewrite: {
      "^/api": "",
    },
    onProxyReq: (proxyReq, req) => {
      console.log("📨 Proxy request:", {
        originalUrl: req.originalUrl,
        targetUrl: proxyReq.path,
        method: req.method,
        headers: proxyReq.getHeaders(),
      });
    },
    onProxyRes: (proxyRes, req) => {
      console.log("📨 Proxy response:", {
        statusCode: proxyRes.statusCode,
        headers: proxyRes.headers,
        originalUrl: req.originalUrl,
      });
    },
    onError: (err, req, res) => {
      console.error("❌ Erro no proxy:", err);
      res.status(500).json({ error: "Erro ao comunicar com o backend" });
    },
  })
);

// Servir arquivos estáticos do frontend
const staticOptions = {
  maxAge: "1h",
  setHeaders: (res, path) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Cache mais longo para assets
    if (path.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000");
    }
  },
};

app.use(express.static(join(__dirname, "dist"), staticOptions));

// Rota fallback para SPA
app.get("*", (req, res) => {
  console.log("🔄 Fallback route:", req.url);
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Iniciar servidor
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando em http://0.0.0.0:${PORT}`);
  if (process.env.VIRTUAL_HOST) {
    console.log(`🔒 HTTPS disponível em https://${process.env.VIRTUAL_HOST}`);
  }
});

// Configurar timeout mais longo
server.timeout = 120000; // 2 minutos

// Gerenciar processo
process.on("SIGTERM", () => {
  console.log("📥 Recebido sinal SIGTERM");
  server.close(() => {
    console.log("🛑 Servidor HTTP fechado");
    backend.kill("SIGTERM");
  });
});

process.on("SIGINT", () => {
  console.log("📥 Recebido sinal SIGINT");
  server.close(() => {
    console.log("🛑 Servidor HTTP fechado");
    backend.kill("SIGINT");
  });
});

backend.on("exit", (code) => {
  console.log(`Backend encerrado com código ${code}`);
  process.exit(code);
});
