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

  // Validar dados obrigatórios
  if (!number || !message || !scheduledAt || !apiUrl || !instance || !token) {
    console.error(
      "[POST /api/schedules] Dados obrigatórios faltando:",
      req.body
    );
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  // Validar formato do número
  const cleanNumber = number.replace(/\D/g, "");
  if (!/^\d{10,}$/.test(cleanNumber)) {
    return res.status(400).json({ error: "Número de telefone inválido" });
  }

  // Validar data de agendamento
  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ error: "Data de agendamento inválida" });
  }

  // Validar se data não é no passado
  if (scheduledDate <= new Date()) {
    return res
      .status(400)
      .json({ error: "Data de agendamento deve ser no futuro" });
  }

  // Validar URL da API
  try {
    new URL(apiUrl);
  } catch (error) {
    return res.status(400).json({ error: "URL da API inválida" });
  }

  // Validar nome da instância
  const trimmedInstance = instance.trim();
  if (!trimmedInstance) {
    return res.status(400).json({ error: "Nome da instância é obrigatório" });
  }
  if (!/^[a-zA-Z0-9\s-_]+$/.test(trimmedInstance)) {
    return res
      .status(400)
      .json({ error: "Nome da instância contém caracteres inválidos" });
  }
  if (trimmedInstance !== instance) {
    return res
      .status(400)
      .json({
        error: "Nome da instância não pode começar ou terminar com espaços",
      });
  }

  // Criar agendamento
  const schedules = loadSchedules();
  const newSchedule = {
    id: Date.now().toString(),
    number: cleanNumber,
    message: message.trim(),
    scheduledAt,
    apiUrl: apiUrl.trim().replace(/\/+$/, "") + "/", // Garantir uma única / no final
    instance: instance.trim(),
    token: token.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
    processedAt: null,
    error: null,
    retries: 0,
  };

  // Salvar agendamento
  schedules.push(newSchedule);
  saveSchedules(schedules);
  console.log("[POST /api/schedules] Novo agendamento salvo:", newSchedule);

  // Testar conectividade com a Evolution API
  testEvolutionAPI(newSchedule)
    .then((result) => {
      if (!result.success) {
        console.warn(
          "[POST /api/schedules] Aviso: Evolution API não está respondendo"
        );
      }
    })
    .catch((error) => {
      console.error(
        "[POST /api/schedules] Erro ao testar Evolution API:",
        error
      );
    });

  res.status(201).json(newSchedule);
});

// Cancelar agendamento
app.delete("/api/schedules/:id", (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  console.log(`[DELETE /api/schedules/${id}] Cancelando agendamento`);
  console.log(`   Motivo: ${reason || "Não informado"}`);

  let schedules = loadSchedules();
  const schedule = schedules.find((s) => s.id === id);

  if (!schedule) {
    console.error(`[DELETE /api/schedules/${id}] Agendamento não encontrado`);
    return res.status(404).json({ error: "Agendamento não encontrado" });
  }

  if (schedule.status === "sent") {
    console.error(
      `[DELETE /api/schedules/${id}] Não é possível cancelar mensagem já enviada`
    );
    return res
      .status(400)
      .json({ error: "Não é possível cancelar mensagem já enviada" });
  }

  schedule.status = "cancelled";
  schedule.processedAt = new Date().toISOString();
  schedule.error = reason || "Cancelado pelo usuário";

  console.log(`[DELETE /api/schedules/${id}] Agendamento cancelado:`, schedule);
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
        const sent = await sendMessageWithRetry(
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

// Debug: Testar conectividade com Evolution API
app.post("/api/debug/test-evolution", async (req, res) => {
  const { apiUrl, instance, token, number, message } = req.body;

  if (!apiUrl || !instance || !token) {
    return res.status(400).json({
      error: "apiUrl, instance e token são obrigatórios",
    });
  }

  console.log("🧪 Testando conectividade com Evolution API:");
  console.log(`   🌐 API URL: ${apiUrl}`);
  console.log(`   🔧 Instância: ${instance}`);
  console.log(`   📞 Número: ${number || "Não fornecido"}`);
  console.log(`   💬 Mensagem: ${message || "Teste de conectividade"}`);

  try {
    // Teste 1: Verificar se a API está respondendo
    console.log("🔍 Teste 1: Verificando se a API está respondendo...");
    const infoResponse = await axios.get(`${apiUrl}`, { timeout: 5000 });
    console.log("✅ API está respondendo:", infoResponse.data);

    // Teste 2: Verificar instância
    console.log("🔍 Teste 2: Verificando instância...");
    const instanceResponse = await axios.get(
      `${apiUrl}/instance/info/${instance}`,
      {
        headers: { apikey: token },
        timeout: 5000,
      }
    );
    console.log("✅ Instância encontrada:", instanceResponse.data);

    // Teste 3: Enviar mensagem de teste
    if (number && message) {
      console.log("🔍 Teste 3: Enviando mensagem de teste...");
      const testResult = await sendMessageWithRetry(
        number,
        message,
        apiUrl,
        instance,
        token
      );

      res.json({
        success: true,
        message: "Teste concluído com sucesso",
        apiInfo: infoResponse.data,
        instanceInfo: instanceResponse.data,
        messageSent: testResult,
      });
    } else {
      res.json({
        success: true,
        message: "Conectividade OK - API e instância funcionando",
        apiInfo: infoResponse.data,
        instanceInfo: instanceResponse.data,
        messageSent: false,
      });
    }
  } catch (error) {
    console.error(
      "❌ Erro no teste de conectividade:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      error: "Falha na conectividade",
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
      },
    });
  }
});

// Função para enviar mensagem via Evolution API com retry
async function sendMessageWithRetry(
  number,
  message,
  apiUrl,
  instance,
  token,
  retries = 3
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📤 Tentativa ${attempt}/${retries} de enviar mensagem:`);
      console.log(`   📞 Número: ${number}`);
      console.log(`   💬 Mensagem: ${message}`);
      console.log(`   🌐 API URL: ${apiUrl}`);
      console.log(`   🔧 Instância: ${instance}`);
      console.log(`   🔑 Token: ${token ? "Configurado" : "Não configurado"}`);

      if (!apiUrl || !instance || !token) {
        throw new Error("Configuração inválida");
      }

      const url = `${apiUrl}/message/sendText/${instance}`;
      const payload = { number, text: message };
      const headers = { apikey: token, "Content-Type": "application/json" };

      console.log(`🌐 Fazendo requisição para: ${url}`);
      console.log(`📦 Payload:`, payload);

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000, // 10 segundos
      });

      console.log(`✅ Mensagem enviada com sucesso:`, {
        status: response.status,
        data: response.data,
      });

      return true;
    } catch (err) {
      console.error(`❌ Erro na tentativa ${attempt}:`, {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      // Se for erro de autenticação ou instância não encontrada, não tentar novamente
      if (err.response?.status === 401 || err.response?.status === 404) {
        throw err;
      }

      // Se for última tentativa, propagar o erro
      if (attempt === retries) {
        throw err;
      }

      // Esperar antes da próxima tentativa (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return false;
}

// Função para testar conectividade com Evolution API
async function testEvolutionAPI(schedule) {
  const { apiUrl, instance, token, number, message } = schedule;

  if (!apiUrl || !instance || !token) {
    return { success: false, message: "Configuração incompleta para teste" };
  }

  console.log(
    "🧪 Testando conectividade com Evolution API para o agendamento:",
    schedule.id
  );
  console.log(`   🌐 API URL: ${apiUrl}`);
  console.log(`   🔧 Instância: ${instance}`);
  console.log(`   📞 Número: ${number || "Não fornecido"}`);
  console.log(`   💬 Mensagem: ${message || "Teste de conectividade"}`);

  try {
    // Teste 1: Verificar se a API está respondendo
    console.log("🔍 Teste 1: Verificando se a API está respondendo...");
    const infoResponse = await axios.get(`${apiUrl}`, { timeout: 5000 });
    console.log("✅ API está respondendo:", infoResponse.data);

    // Teste 2: Verificar instância
    console.log("🔍 Teste 2: Verificando instância...");
    const instanceResponse = await axios.get(
      `${apiUrl}/instance/info/${instance}`,
      {
        headers: { apikey: token },
        timeout: 5000,
      }
    );
    console.log("✅ Instância encontrada:", instanceResponse.data);

    // Teste 3: Enviar mensagem de teste
    if (number && message) {
      console.log("🔍 Teste 3: Enviando mensagem de teste...");
      const testResult = await sendMessageWithRetry(
        number,
        message,
        apiUrl,
        instance,
        token
      );

      return {
        success: true,
        message: "Teste concluído com sucesso",
        apiInfo: infoResponse.data,
        instanceInfo: instanceResponse.data,
        messageSent: testResult,
      };
    } else {
      return {
        success: true,
        message: "Conectividade OK - API e instância funcionando",
        apiInfo: infoResponse.data,
        instanceInfo: instanceResponse.data,
        messageSent: false,
      };
    }
  } catch (error) {
    console.error(
      "❌ Erro no teste de conectividade:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: "Falha na conectividade",
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
      },
    };
  }
}

// Processador de agendamentos com melhor tratamento de erros
async function processScheduledMessages() {
  console.log("⏰ Verificando agendamentos...");

  try {
    const schedules = loadSchedules();
    const now = new Date();
    let changed = false;

    console.log(`📊 Total de agendamentos: ${schedules.length}`);
    console.log(`🕐 Hora atual: ${now.toISOString()}`);

    for (const sched of schedules) {
      try {
        console.log(`\n📋 Verificando agendamento ID: ${sched.id}`);
        console.log(`   Status: ${sched.status}`);
        console.log(`   Agendado para: ${sched.scheduledAt}`);

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
              try {
                const sent = await sendMessageWithRetry(
                  sched.number,
                  sched.message,
                  sched.apiUrl,
                  sched.instance,
                  sched.token
                );

                sched.status = sent ? "sent" : "failed";
                sched.processedAt = new Date().toISOString();
                sched.error = sent ? null : "Falha no envio após tentativas";
                changed = true;

                console.log(
                  `   ${sent ? "✅ Enviado com sucesso!" : "❌ Falha no envio"}`
                );
              } catch (error) {
                sched.status = "failed";
                sched.processedAt = new Date().toISOString();
                sched.error = error.response?.data?.message || error.message;
                changed = true;

                console.error(`   ❌ Erro ao enviar:`, sched.error);
              }
            } else {
              console.log(`   ⏭️  Ignorado - faltam dados de configuração`);
              sched.status = "failed";
              sched.processedAt = new Date().toISOString();
              sched.error = "Configuração incompleta";
              changed = true;
            }
          } else {
            console.log(`   ⏳ Ainda não é hora de enviar`);
          }
        } else {
          console.log(`   ⏭️  Agendamento já processado (${sched.status})`);
        }
      } catch (error) {
        console.error(`❌ Erro ao processar agendamento ${sched.id}:`, error);
      }
    }

    if (changed) {
      console.log(`💾 Salvando alterações...`);
      saveSchedules(schedules);
      console.log(`✅ Alterações salvas!`);
    } else {
      console.log(`📝 Nenhuma alteração necessária`);
    }
  } catch (error) {
    console.error("❌ Erro no processador de agendamentos:", error);
  }
}

// Iniciar processador
const PROCESSOR_INTERVAL = 60000; // 60 segundos
setInterval(processScheduledMessages, PROCESSOR_INTERVAL);

// Executar imediatamente na primeira vez
processScheduledMessages();

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}/`);
  console.log(`📋 Endpoints disponíveis:`);
  console.log(`   GET  /api/schedules - Listar agendamentos`);
  console.log(`   POST /api/schedules - Criar agendamento`);
  console.log(`   DELETE /api/schedules/:id - Cancelar agendamento`);
  console.log(`   POST /api/debug/process-schedules - Forçar processamento`);
  console.log(`   GET  /api/debug/schedules-status - Status dos agendamentos`);
  console.log(`   POST /api/debug/test-evolution - Testar Evolution API`);
  console.log(`⏰ Processador de mensagens iniciado (verifica a cada 60s)`);
});
