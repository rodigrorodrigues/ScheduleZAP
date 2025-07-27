import express from "express";
import cors from "cors";
import fs from "fs";
import axios from "axios";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 8999;
const SCHEDULE_FILE = join(__dirname, "schedules.json");

// Middleware
app.use(express.json());
app.use(cors());

// Garantir que o arquivo de agendamentos existe
if (!fs.existsSync(SCHEDULE_FILE)) {
  fs.writeFileSync(SCHEDULE_FILE, "[]", "utf8");
}

// Funções auxiliares
function loadSchedules() {
  try {
    const data = fs.readFileSync(SCHEDULE_FILE, "utf8");
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("❌ Erro ao carregar agendamentos:", error);
    return [];
  }
}

function saveSchedules(schedules) {
  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
  } catch (error) {
    console.error("❌ Erro ao salvar agendamentos:", error);
  }
}

// Rotas
app.get("/api/schedules", (req, res) => {
  try {
    const schedules = loadSchedules();
    res.json(schedules);
  } catch (error) {
    console.error("❌ Erro ao listar agendamentos:", error);
    res.status(500).json({ error: "Erro interno ao listar agendamentos" });
  }
});

app.post("/api/schedules", (req, res) => {
  try {
    const { number, message, scheduledAt, apiUrl, instance, token } = req.body;

    // Validações
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
    res.status(201).json(newSchedule);
  } catch (error) {
    console.error("❌ Erro ao criar agendamento:", error);
    res.status(500).json({ error: "Erro interno ao criar agendamento" });
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
    res.json({ message: "Agendamento cancelado" });
  } catch (error) {
    console.error("❌ Erro ao cancelar agendamento:", error);
    res.status(500).json({ error: "Erro interno ao cancelar agendamento" });
  }
});

// Processador de mensagens agendadas
async function processScheduledMessages() {
  try {
    const schedules = loadSchedules();
    const now = new Date();
    let changed = false;

    for (const schedule of schedules) {
      if (
        schedule.status === "pending" &&
        new Date(schedule.scheduledAt) <= now
      ) {
        console.log(
          `⏰ Processando agendamento ${schedule.id} para ${schedule.number}`
        );

        try {
          const response = await axios.post(
            `${schedule.apiUrl}message/sendText/${encodeURIComponent(
              schedule.instance
            )}`,
            {
              number: schedule.number,
              text: schedule.message,
              delay: 1000,
            },
            {
              headers: { apikey: schedule.token },
              timeout: 10000,
            }
          );

          schedule.status = response.status === 200 ? "sent" : "failed";
          schedule.processedAt = new Date().toISOString();
          schedule.error =
            response.status !== 200 ? `Status: ${response.status}` : null;
          changed = true;

          console.log(`✅ Mensagem processada: ${schedule.status}`);
        } catch (error) {
          schedule.status = "failed";
          schedule.processedAt = new Date().toISOString();
          schedule.error = error.message;
          schedule.retries++;
          changed = true;

          console.error("❌ Erro ao enviar mensagem:", error.message);
        }
      }
    }

    if (changed) {
      saveSchedules(schedules);
    }
  } catch (error) {
    console.error("❌ Erro no processador:", error);
  }
}

// Iniciar processador
setInterval(processScheduledMessages, 60000);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
