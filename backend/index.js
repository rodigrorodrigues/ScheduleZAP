import express from "express";
import fs from "fs";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const SCHEDULE_FILE = "./schedules.json";
const PORT = 8080;

// Utilitários de armazenamento
function loadSchedules() {
  if (!fs.existsSync(SCHEDULE_FILE)) return [];
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE));
}
function saveSchedules(schedules) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
}

// Listar agendamentos
app.get("/api/schedules", (req, res) => {
  res.json(loadSchedules());
});

// Criar agendamento
app.post("/api/schedules", (req, res) => {
  const { number, message, scheduledAt, apiUrl, instance, token } = req.body;
  if (!number || !message || !scheduledAt || !apiUrl || !instance || !token)
    return res.status(400).json({ error: "Dados obrigatórios" });
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
  };
  schedules.push(newSchedule);
  saveSchedules(schedules);
  res.status(201).json(newSchedule);
});

// Cancelar agendamento
app.delete("/api/schedules/:id", (req, res) => {
  let schedules = loadSchedules();
  schedules = schedules.map((s) =>
    s.id === req.params.id ? { ...s, status: "cancelled" } : s
  );
  saveSchedules(schedules);
  res.status(204).end();
});

// Função para enviar mensagem via Evolution API
async function sendMessage(number, message, apiUrl, instance, token) {
  console.log("Enviando para Evolution API:", {
    apiUrl,
    instance,
    token,
    number,
    message,
  });
  if (!apiUrl || !instance || !token) {
    console.error("Agendamento inválido: faltam dados de configuração.");
    return false;
  }
  try {
    await axios.post(
      `${apiUrl}/message/sendText/${instance}`,
      { number, text: message, delay: 1000 },
      { headers: { apikey: token, "Content-Type": "application/json" } }
    );
    return true;
  } catch (err) {
    console.error(
      "Erro ao enviar mensagem:",
      err.response?.data || err.message
    );
    return false;
  }
}

// Processador de agendamentos (roda a cada minuto)
setInterval(async () => {
  const schedules = loadSchedules();
  const now = new Date();
  let changed = false;
  for (const sched of schedules) {
    if (
      sched.status === "pending" &&
      new Date(sched.scheduledAt) <= now &&
      sched.apiUrl &&
      sched.instance &&
      sched.token
    ) {
      const sent = await sendMessage(
        sched.number,
        sched.message,
        sched.apiUrl,
        sched.instance,
        sched.token
      );
      sched.status = sent ? "sent" : "failed";
      changed = true;
    } else if (
      sched.status === "pending" &&
      (!sched.apiUrl || !sched.instance || !sched.token)
    ) {
      console.error("Agendamento ignorado por falta de configuração:", sched);
    }
  }
  if (changed) saveSchedules(schedules);
}, 60000);

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}/`);
});
