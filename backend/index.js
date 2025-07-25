import express from "express";
import fs from "fs";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const SCHEDULE_FILE = "./schedules.json";
const PORT = process.env.PORT || 8999;

// Utilitários de armazenamento
function loadSchedules() {
  try {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    const content = fs.readFileSync(SCHEDULE_FILE, "utf8");
    if (!content.trim()) return [];
    return JSON.parse(content);
  } catch (error) {
    console.error("Erro ao carregar schedules.json:", error);
    return [];
  }
}
function saveSchedules(schedules) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
}

// Listar agendamentos
app.get("/api/schedules", (req, res) => {
  try {
    const schedules = loadSchedules();
    res.json(Array.isArray(schedules) ? schedules : []);
  } catch (error) {
    res.json([]);
  }
});

// Criar agendamento
app.post("/api/schedules", (req, res) => {
  console.log("[POST /api/schedules] Recebido corpo:", req.body);
  const { number, message, scheduledAt, apiUrl, instance, token } = req.body;
  if (!number || !message || !scheduledAt || !apiUrl || !instance || !token) {
    console.error(
      "[POST /api/schedules] Dados obrigatórios faltando:",
      req.body
    );
    return res.status(400).json({ error: "Dados obrigatórios" });
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
  };
  schedules.push(newSchedule);
  saveSchedules(schedules);
  console.log("[POST /api/schedules] Novo agendamento salvo:", newSchedule);
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

// Debug: Forçar processamento de agendamentos
app.post("/api/debug/process-schedules", async (req, res) => {
  console.log("🔧 Debug: Forçando processamento de agendamentos...");

  const schedules = loadSchedules();
  const now = new Date();
  let changed = false;

  console.log(`📊 Total de agendamentos: ${schedules.length}`);

  for (const sched of schedules) {
    if (sched.status === "pending") {
      console.log(`🔧 Processando agendamento ID: ${sched.id}`);

      if (sched.apiUrl && sched.instance && sched.token) {
        const sent = await sendMessage(
          sched.number,
          sched.message,
          sched.apiUrl,
          sched.instance,
          sched.token
        );

        sched.status = sent ? "sent" : "failed";
        changed = true;
        console.log(`   ${sent ? "✅ Enviado" : "❌ Falha"}`);
      } else {
        console.log(`   ⏭️  Ignorado - faltam dados`);
      }
    }
  }

  if (changed) {
    saveSchedules(schedules);
    console.log("💾 Alterações salvas");
  }

  res.json({
    message: "Processamento forçado concluído",
    processed: schedules.filter((s) => s.status !== "pending").length,
    total: schedules.length,
  });
});

// Debug: Status dos agendamentos
app.get("/api/debug/schedules-status", (req, res) => {
  const schedules = loadSchedules();
  const now = new Date();

  const status = schedules.map((s) => ({
    id: s.id,
    number: s.number,
    message: s.message,
    scheduledAt: s.scheduledAt,
    status: s.status,
    isTimeToSend: new Date(s.scheduledAt) <= now,
    hasConfig: !!(s.apiUrl && s.instance && s.token),
    timeDiff: Math.round((new Date(s.scheduledAt) - now) / 1000),
  }));

  res.json({
    currentTime: now.toISOString(),
    total: schedules.length,
    pending: schedules.filter((s) => s.status === "pending").length,
    sent: schedules.filter((s) => s.status === "sent").length,
    failed: schedules.filter((s) => s.status === "failed").length,
    cancelled: schedules.filter((s) => s.status === "cancelled").length,
    schedules: status,
  });
});

// Função para enviar mensagem via Evolution API
async function sendMessage(number, message, apiUrl, instance, token) {
  console.log("📤 Enviando para Evolution API:");
  console.log(`   📞 Número: ${number}`);
  console.log(`   💬 Mensagem: ${message}`);
  console.log(`   🌐 API URL: ${apiUrl}`);
  console.log(`   🔧 Instância: ${instance}`);
  console.log(`   🔑 Token: ${token ? "Configurado" : "Não configurado"}`);

  if (!apiUrl || !instance || !token) {
    console.error("❌ Agendamento inválido: faltam dados de configuração.");
    return false;
  }

  try {
    const url = `${apiUrl}/message/sendText/${instance}`;
    const payload = { number, text: message, delay: 1000 };
    const headers = { apikey: token, "Content-Type": "application/json" };

    console.log(`🌐 Fazendo requisição para: ${url}`);
    console.log(`📦 Payload:`, payload);
    console.log(`🔑 Headers:`, { ...headers, apikey: "***" });

    const response = await axios.post(url, payload, { headers });

    console.log(`✅ Resposta da Evolution API:`, {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
    });

    return true;
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:");
    console.error(`   Status: ${err.response?.status || "N/A"}`);
    console.error(`   Status Text: ${err.response?.statusText || "N/A"}`);
    console.error(`   Data:`, err.response?.data || err.message);
    console.error(`   URL: ${err.config?.url || "N/A"}`);
    console.error(`   Method: ${err.config?.method || "N/A"}`);

    if (err.response?.status === 401) {
      console.error("🔐 Erro 401: Token inválido ou não autorizado");
    } else if (err.response?.status === 404) {
      console.error("🔍 Erro 404: Instância não encontrada");
    } else if (err.response?.status === 400) {
      console.error("📝 Erro 400: Dados inválidos na requisição");
    }

    return false;
  }
}

// Processador de agendamentos (roda a cada minuto)
setInterval(async () => {
  console.log("⏰ Verificando agendamentos...");
  const schedules = loadSchedules();
  const now = new Date();
  let changed = false;

  console.log(`📊 Total de agendamentos: ${schedules.length}`);
  console.log(`🕐 Hora atual: ${now.toISOString()}`);

  for (const sched of schedules) {
    console.log(`\n📋 Verificando agendamento ID: ${sched.id}`);
    console.log(`   Status: ${sched.status}`);
    console.log(`   Agendado para: ${sched.scheduledAt}`);
    console.log(`   Número: ${sched.number}`);
    console.log(`   API URL: ${sched.apiUrl}`);
    console.log(`   Instância: ${sched.instance}`);
    console.log(`   Token: ${sched.token ? "Configurado" : "Não configurado"}`);

    if (sched.status === "pending") {
      const scheduledTime = new Date(sched.scheduledAt);
      const timeDiff = scheduledTime - now;

      console.log(
        `   ⏱️  Diferença de tempo: ${timeDiff}ms (${Math.round(
          timeDiff / 1000
        )}s)`
      );

      if (scheduledTime <= now) {
        console.log(`   ✅ Hora de enviar!`);

        if (sched.apiUrl && sched.instance && sched.token) {
          console.log(`   🚀 Tentando enviar mensagem...`);
          const sent = await sendMessage(
            sched.number,
            sched.message,
            sched.apiUrl,
            sched.instance,
            sched.token
          );

          sched.status = sent ? "sent" : "failed";
          console.log(
            `   ${sent ? "✅ Enviado com sucesso!" : "❌ Falha no envio"}`
          );
          changed = true;
        } else {
          console.log(
            `   ❌ Agendamento ignorado - faltam dados de configuração`
          );
          console.log(`      apiUrl: ${sched.apiUrl ? "OK" : "FALTANDO"}`);
          console.log(`      instance: ${sched.instance ? "OK" : "FALTANDO"}`);
          console.log(`      token: ${sched.token ? "OK" : "FALTANDO"}`);
        }
      } else {
        console.log(`   ⏳ Ainda não é hora de enviar`);
      }
    } else {
      console.log(`   ⏭️  Agendamento já processado (status: ${sched.status})`);
    }
  }

  if (changed) {
    console.log(`💾 Salvando alterações...`);
    saveSchedules(schedules);
    console.log(`✅ Alterações salvas!`);
  } else {
    console.log(`📝 Nenhuma alteração necessária`);
  }

  console.log("⏰ Verificação concluída\n");
}, 60000);

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}/`);
  console.log(`📋 Endpoints disponíveis:`);
  console.log(`   GET  /api/schedules - Listar agendamentos`);
  console.log(`   POST /api/schedules - Criar agendamento`);
  console.log(`   DELETE /api/schedules/:id - Cancelar agendamento`);
  console.log(`   POST /api/debug/process-schedules - Forçar processamento`);
  console.log(`   GET  /api/debug/schedules-status - Status dos agendamentos`);
  console.log(`⏰ Processador de mensagens iniciado (verifica a cada 60s)`);
});
