import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações
const PORT = parseInt(process.env.PORT || "8988", 10);
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || "8999", 10);

// Log de configuração
console.log("📝 Configuração:", {
  NODE_ENV: process.env.NODE_ENV,
  PORT,
  BACKEND_PORT,
});

let server = null;
let backend = null;
let isShuttingDown = false;

// Função para encerramento gracioso
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n📥 Recebido sinal ${signal}`);

  // Criar uma promise para aguardar o encerramento do servidor
  const closeServer = () =>
    new Promise((resolve) => {
      if (!server) {
        resolve();
        return;
      }

      console.log("🛑 Fechando servidor HTTP...");
      server.close(() => {
        console.log("✅ Servidor HTTP fechado");
        resolve();
      });
    });

  // Criar uma promise para aguardar o encerramento do backend
  const closeBackend = () =>
    new Promise((resolve) => {
      if (!backend) {
        resolve();
        return;
      }

      console.log("🛑 Encerrando backend...");
      backend.kill(signal);
      backend.once("exit", (code, sig) => {
        console.log(`✅ Backend encerrado (código: ${code}, sinal: ${sig})`);
        resolve();
      });
    });

  try {
    // Aguardar o encerramento de ambos os processos
    await Promise.race([
      Promise.all([closeServer(), closeBackend()]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 25000)
      ),
    ]);
    console.log("✅ Encerramento gracioso concluído");
    process.exit(0);
  } catch (error) {
    console.error("⚠️ Timeout no encerramento gracioso, forçando saída");
    process.exit(1);
  }
};

// Configurar servidor Express para o frontend
const app = express();

// Iniciar o backend
const startBackend = () => {
  console.log("🚀 Iniciando backend...");
  backend = spawn("node", ["backend/index.js"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: BACKEND_PORT.toString(),
    },
  });

  backend.on("exit", (code, signal) => {
    if (!isShuttingDown) {
      console.error(
        `❌ Backend encerrou inesperadamente (código: ${code}, sinal: ${signal})`
      );
      process.exit(1);
    }
  });
};

// Configurar proxy reverso
app.use(
  "/api",
  createProxyMiddleware({
    target: `http://localhost:${BACKEND_PORT}`,
    changeOrigin: true,
    pathRewrite: {
      "^/api": "",
    },
    onError: (err, req, res) => {
      console.error("❌ Erro no proxy:", err.message);
      res.status(500).json({ error: "Erro ao comunicar com o backend" });
    },
  })
);

// Servir arquivos estáticos do frontend
app.use(
  express.static(join(__dirname, "dist"), {
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

// Iniciar servidor e backend
const start = async () => {
  try {
    // Iniciar backend primeiro
    startBackend();

    // Aguardar um pouco para o backend iniciar
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Iniciar servidor HTTP
    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });

    // Configurar timeout do servidor
    server.timeout = 120000; // 2 minutos
    server.keepAliveTimeout = 65000; // 65 segundos
    server.headersTimeout = 66000; // 66 segundos
  } catch (error) {
    console.error("❌ Erro ao iniciar servidor:", error);
    process.exit(1);
  }
};

// Gerenciar sinais do processo
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Gerenciar erros não tratados
process.on("uncaughtException", (error) => {
  console.error("❌ Erro não tratado:", error);
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Promise rejeitada não tratada:", reason);
  shutdown("SIGTERM");
});

// Iniciar a aplicação
start();
