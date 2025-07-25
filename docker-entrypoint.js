import express from "express";
import serveStatic from "serve-static";
import path from "path";
import fs from "fs";
import axios from "axios";
import cors from "cors";

const FRONTEND_PORT = 8988;
const BACKEND_PORT = 8999;
const SCHEDULE_FILE = "./schedules.json";

// --- Backend API ---
const backend = express();
backend.use(express.json());
backend.use(cors());

function loadSchedules() {
  if (!fs.existsSync(SCHEDULE_FILE)) return [];
  return JSON.parse(fs.readFileSync(SCHEDULE_FILE));
}
function saveSchedules(schedules) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
}

backend.get("/api/schedules", (req, res) => {
  res.json(loadSchedules());
});

backend.post("/api/schedules", (req, res) => {
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

backend.delete("/api/schedules/:id", (req, res) => {
  let schedules = loadSchedules();
  schedules = schedules.map((s) =>
    s.id === req.params.id ? { ...s, status: "cancelled" } : s
  );
  saveSchedules(schedules);
  res.status(204).end();
});

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

backend.listen(BACKEND_PORT, () => {
  console.log(
    `API backend rodando em http://localhost:${BACKEND_PORT}/api/schedules`
  );
});

// --- Frontend ---
const frontend = express();
const publicDir = path.resolve("./public");
frontend.use(serveStatic(publicDir));
// SPA fallback para frontend
frontend.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});
frontend.listen(FRONTEND_PORT, () => {
  console.log(`Frontend rodando em http://localhost:${FRONTEND_PORT}/`);
});
