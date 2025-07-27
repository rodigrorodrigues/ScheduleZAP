import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações
const PORT = process.env.PORT || 8988;
const BACKEND_PORT = process.env.BACKEND_PORT || 8999;

// Log de configuração
console.log("📝 Configuração:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT,
  BACKEND_PORT,
  PWD: process.cwd(),
  HOSTNAME: process.env.HOSTNAME,
});

// Configurar servidor Express para o frontend
const app = express();

// Iniciar o backend
console.log("🚀 Iniciando backend...");
const backend = spawn("node", ["backend/index.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: BACKEND_PORT.toString(),
  },
});

// Aguardar backend iniciar
await new Promise((resolve) => setTimeout(resolve, 2000));

// Configurar headers para proxy reverso
app.set("trust proxy", true);
app.use((req, res, next) => {
  // Log da requisição
  console.log("📥 Requisição:", {
    method: req.method,
    url: req.url,
    ip: req.ip,
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
      });
    },
    onProxyRes: (proxyRes, req) => {
      console.log("📨 Proxy response:", {
        statusCode: proxyRes.statusCode,
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

// Variável para controlar o estado do servidor
let isShuttingDown = false;

// Iniciar servidor
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Servidor rodando em http://0.0.0.0:${PORT}`);
});

// Configurar timeout mais longo
server.timeout = 120000; // 2 minutos

// Função para encerramento gracioso
const shutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`📥 Recebido sinal ${signal}`);

  // Parar de aceitar novas conexões
  server.close(() => {
    console.log("🛑 Servidor HTTP fechado");

    // Encerrar o backend
    if (backend) {
      console.log("🛑 Encerrando backend...");
      backend.kill(signal);
    }
  });

  // Forçar encerramento após 10 segundos
  setTimeout(() => {
    console.log("⚠️ Forçando encerramento após timeout");
    process.exit(1);
  }, 10000);
};

// Gerenciar sinais do processo
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Gerenciar erros não tratados
process.on("uncaughtException", (error) => {
  console.error("❌ Erro não tratado:", error);
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Promise rejeitada não tratada:", reason);
  shutdown("SIGTERM");
});

// Monitorar processo do backend
backend.on("exit", (code, signal) => {
  console.log(`Backend encerrado com código ${code} e sinal ${signal}`);
  if (!isShuttingDown) {
    console.error(
      "❌ Backend encerrou inesperadamente, reiniciando servidor..."
    );
    process.exit(1); // O Docker irá reiniciar o contêiner
  }
});
