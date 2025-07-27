import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";

// Configuração para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração básica
const app = express();
const PORT = process.env.PORT || 8988;
const SCHEDULES_FILE = path.join(__dirname, "backend", "schedules.json");

// Garantir que o arquivo de agendamentos existe
function initializeSchedulesFile() {
  try {
    if (!fs.existsSync(SCHEDULES_FILE)) {
      console.log("📝 Criando arquivo de agendamentos...");
      fs.writeFileSync(SCHEDULES_FILE, "[]", "utf8");
      console.log("✅ Arquivo de agendamentos criado com sucesso");
    }
  } catch (error) {
    console.error("❌ Erro ao inicializar arquivo de agendamentos:", error);
    process.exit(1);
  }
}

// Inicializar arquivo de agendamentos
initializeSchedulesFile();

// Middleware
app.use(express.json());
app.use(cors());

// Middleware de log
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`
    );
  });
  next();
});

// Middleware de erro
app.use((err, req, res, next) => {
  console.error("❌ Erro não tratado:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
});

// Funções auxiliares
function loadSchedules() {
  try {
    initializeSchedulesFile(); // Garantir que o arquivo existe antes de ler
    const data = fs.readFileSync(SCHEDULES_FILE, "utf8");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("❌ Erro ao carregar agendamentos:", error);
    return [];
  }
}

function saveSchedules(schedules) {
  try {
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
  } catch (error) {
    console.error("❌ Erro ao salvar agendamentos:", error);
  }
}

// Rotas da API
app.get("/api/schedules", (req, res) => {
  try {
    const schedules = loadSchedules();
    res.json(schedules);
  } catch (error) {
    console.error("❌ Erro ao listar agendamentos:", error);
    res.status(500).json({ error: "Erro ao listar agendamentos" });
  }
});

app.post("/api/schedules", (req, res) => {
  try {
    const { number, message, scheduledAt, apiUrl, instance, token } = req.body;

    if (!number || !message || !scheduledAt || !apiUrl || !instance || !token) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const schedules = loadSchedules();
    const newSchedule = {
      id: Date.now().toString(),
      number,
      message,
      scheduledAt,
      apiUrl,
      instance,
      token,
      status: "pending",
      createdAt: new Date().toISOString(),
      processedAt: null,
      error: null,
      retries: 0,
    };

    schedules.push(newSchedule);
    saveSchedules(schedules);
    console.log("✅ Novo agendamento criado:", newSchedule.id);
    res.status(201).json(newSchedule);
  } catch (error) {
    console.error("❌ Erro ao criar agendamento:", error);
    res.status(500).json({ error: "Erro ao criar agendamento" });
  }
});

app.delete("/api/schedules/:id", (req, res) => {
  try {
    const schedules = loadSchedules();
    const index = schedules.findIndex((s) => s.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    schedules[index].status = "cancelled";
    saveSchedules(schedules);
    console.log("✅ Agendamento cancelado:", req.params.id);
    res.json({ message: "Agendamento cancelado" });
  } catch (error) {
    console.error("❌ Erro ao cancelar agendamento:", error);
    res.status(500).json({ error: "Erro ao cancelar agendamento" });
  }
});

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, "dist")));

// Rota fallback para SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Processador de mensagens agendadas
let processorInterval;

async function processSchedules() {
  try {
    const schedules = loadSchedules();
    const now = new Date();
    let changed = false;

    console.log(`🔄 Processando ${schedules.length} agendamentos...`);

    for (const schedule of schedules) {
      if (
        schedule.status === "pending" &&
        new Date(schedule.scheduledAt) <= now
      ) {
        console.log(`📤 Enviando mensagem: ${schedule.id}`);

        try {
          const response = await fetch(
            `${schedule.apiUrl}/message/sendText/${encodeURIComponent(
              schedule.instance
            )}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: schedule.token,
              },
              body: JSON.stringify({
                number: schedule.number,
                text: schedule.message,
                delay: 1000,
              }),
            }
          );

          const responseText = await response.text();
          console.log(
            `📤 Resposta da API: ${response.status} - ${responseText}`
          );

          schedule.status = response.ok ? "sent" : "failed";
          schedule.processedAt = new Date().toISOString();
          schedule.error = response.ok
            ? null
            : `Status: ${response.status} - ${responseText}`;
          changed = true;

          console.log(`✅ Mensagem ${schedule.status}: ${schedule.id}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar mensagem ${schedule.id}:`, error);
          schedule.status = "failed";
          schedule.processedAt = new Date().toISOString();
          schedule.error = error.message;
          schedule.retries++;
          changed = true;
        }
      }
    }

    if (changed) {
      saveSchedules(schedules);
      console.log("💾 Agendamentos atualizados");
    }
  } catch (error) {
    console.error("❌ Erro no processador:", error);
  }
}

// Função de limpeza
function cleanup() {
  console.log("\n🛑 Encerrando servidor...");
  if (processorInterval) {
    clearInterval(processorInterval);
  }
  process.exit(0);
}

// Tratamento de sinais
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

// Tratamento de erros não capturados
process.on("uncaughtException", (error) => {
  console.error("❌ Erro não capturado:", error);
  cleanup();
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Promise rejeitada não tratada:", reason);
  cleanup();
});

// Iniciar servidor e processador
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📁 Arquivo de agendamentos: ${SCHEDULES_FILE}`);
  processorInterval = setInterval(processSchedules, 60000);
  console.log("🔄 Processador de mensagens iniciado (intervalo: 60s)");
});
