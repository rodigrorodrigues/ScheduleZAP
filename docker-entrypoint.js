import express from "express";
import serveStatic from "serve-static";
import path from "path";
import fs from "fs";
import axios from "axios";
import cors from "cors";

const FRONTEND_PORT = 8988;
const BACKEND_PORT = 8999;
const SCHEDULE_FILE = "./schedules.json";

console.log("🚀 Iniciando ScheduleZAP...");
console.log(`📁 Diretório atual: ${process.cwd()}`);
console.log(`📁 Conteúdo do diretório:`, fs.readdirSync("."));

// Verificar se o diretório public existe
const publicDir = path.resolve("./public");
console.log(`📁 Diretório public: ${publicDir}`);
console.log(
  `📁 Conteúdo do public:`,
  fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : "NÃO EXISTE"
);

// --- Backend API ---
const backend = express();
backend.use(express.json());
backend.use(cors());

console.log("🔧 Configurando backend...");

// Funções para gerenciar agendamentos
function loadSchedules() {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      const data = fs.readFileSync(SCHEDULE_FILE, "utf8");
      // Verificar se o arquivo está vazio ou só tem espaços
      if (!data || data.trim() === "") {
        console.log(
          "📄 Arquivo schedules.json vazio, iniciando com array vazio"
        );
        return [];
      }
      const parsed = JSON.parse(data);
      // Garantir que é um array
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error("❌ Erro ao carregar agendamentos:", error.message);
    // Se o arquivo está corrompido, vamos recriar
    try {
      console.log("🔄 Recriando arquivo schedules.json corrompido");
      fs.writeFileSync(SCHEDULE_FILE, "[]");
    } catch (writeError) {
      console.error("❌ Erro ao recriar schedules.json:", writeError.message);
    }
  }
  return [];
}

function saveSchedules(schedules) {
  try {
    // Garantir que schedules é um array
    const dataToSave = Array.isArray(schedules) ? schedules : [];
    const jsonData = JSON.stringify(dataToSave, null, 2);
    fs.writeFileSync(SCHEDULE_FILE, jsonData);
    console.log("💾 Agendamentos salvos com sucesso");
  } catch (error) {
    console.error("❌ Erro ao salvar agendamentos:", error.message);
  }
}

// API: Listar agendamentos
backend.get("/api/schedules", (req, res) => {
  console.log("📋 GET /api/schedules - Listando agendamentos");
  try {
    const schedules = loadSchedules();
    res.json(schedules);
  } catch (error) {
    console.error("❌ Erro ao listar agendamentos:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// API: Criar agendamento
backend.post("/api/schedules", (req, res) => {
  console.log("➕ POST /api/schedules - Criando agendamento:", req.body);
  try {
    const { number, message, scheduledAt, apiUrl, instance, token } = req.body;

    if (!number || !message || !scheduledAt || !apiUrl || !instance || !token) {
      console.error("❌ Dados obrigatórios faltando:", {
        number,
        message,
        scheduledAt,
        apiUrl,
        instance,
        token,
      });
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
    console.log("✅ Agendamento criado:", newSchedule.id);
    res.status(201).json(newSchedule);
  } catch (error) {
    console.error("❌ Erro ao criar agendamento:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// API: Cancelar agendamento
backend.delete("/api/schedules/:id", (req, res) => {
  console.log(
    "❌ DELETE /api/schedules/" + req.params.id + " - Cancelando agendamento"
  );
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
    res.status(500).json({ error: "Erro interno" });
  }
});

// Função para enviar mensagem via Evolution API
async function sendMessage(number, message, apiUrl, instance, token) {
  console.log("📤 Enviando para Evolution API:", {
    apiUrl,
    instance,
    token,
    number,
    message,
  });

  if (!apiUrl || !instance || !token) {
    console.error("❌ Agendamento inválido: faltam dados de configuração.");
    return false;
  }

  try {
    const response = await axios.post(
      `${apiUrl}/message/sendText/${instance}`,
      { number, text: message, delay: 1000 },
      {
        headers: {
          apikey: token,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 segundos de timeout
      }
    );
    console.log("✅ Mensagem enviada com sucesso:", response.status);
    return true;
  } catch (err) {
    console.error(
      "❌ Erro ao enviar mensagem:",
      err.response?.status,
      err.response?.data || err.message
    );
    return false;
  }
}

// Processador de agendamentos (roda a cada minuto)
console.log("⏰ Iniciando processador de agendamentos...");
setInterval(async () => {
  try {
    const schedules = loadSchedules();
    const now = new Date();
    let changed = false;

    console.log(`🔄 Processando ${schedules.length} agendamentos...`);

    for (const sched of schedules) {
      if (sched.status === "pending" && new Date(sched.scheduledAt) <= now) {
        console.log(
          `⏰ Processando agendamento ${sched.id} para ${sched.number}`
        );

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
          console.log(`✅ Agendamento ${sched.id} processado: ${sched.status}`);
        } else {
          console.error(
            "❌ Agendamento ignorado por falta de configuração:",
            sched.id
          );
        }
      }
    }

    if (changed) {
      saveSchedules(schedules);
      console.log("💾 Agendamentos atualizados");
    }
  } catch (error) {
    console.error("❌ Erro no processador de agendamentos:", error);
  }
}, 60000);

backend.listen(BACKEND_PORT, () => {
  console.log(
    `🚀 API backend rodando em http://localhost:${BACKEND_PORT}/api/schedules`
  );
});

// --- Frontend ---
const frontend = express();

if (fs.existsSync(publicDir)) {
  console.log("🌐 Configurando frontend...");
  frontend.use(serveStatic(publicDir));

  // SPA fallback para frontend
  frontend.get("*", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  frontend.listen(FRONTEND_PORT, () => {
    console.log(`🌐 Frontend rodando em http://localhost:${FRONTEND_PORT}/`);
    console.log("✅ ScheduleZAP iniciado com sucesso!");
  });
} else {
  console.error("❌ ERRO: Diretório public não encontrado!");
  console.error("📁 Diretório atual:", process.cwd());
  console.error("📁 Arquivos disponíveis:", fs.readdirSync("."));
  process.exit(1);
}
