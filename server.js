const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

// Configuração básica
const app = express();
const PORT = 8988;
const SCHEDULES_FILE = path.join(__dirname, "backend", "schedules.json");

// Garantir que o arquivo de agendamentos existe
if (!fs.existsSync(SCHEDULES_FILE)) {
  fs.writeFileSync(SCHEDULES_FILE, "[]", "utf8");
}

// Middleware
app.use(express.json());
app.use(cors());

// Funções auxiliares
function loadSchedules() {
  try {
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
    res.status(201).json(newSchedule);
  } catch (error) {
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
    res.json({ message: "Agendamento cancelado" });
  } catch (error) {
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
async function processSchedules() {
  try {
    const schedules = loadSchedules();
    const now = new Date();
    let changed = false;

    for (const schedule of schedules) {
      if (
        schedule.status === "pending" &&
        new Date(schedule.scheduledAt) <= now
      ) {
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

          schedule.status = response.ok ? "sent" : "failed";
          schedule.processedAt = new Date().toISOString();
          schedule.error = response.ok ? null : `Status: ${response.status}`;
          changed = true;
        } catch (error) {
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
    }
  } catch (error) {
    console.error("❌ Erro no processador:", error);
  }
}

// Iniciar servidor e processador
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);

  // Iniciar processador de mensagens
  setInterval(processSchedules, 60000);
});
