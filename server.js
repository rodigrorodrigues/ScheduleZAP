const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 8988;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Configuração de sessão
app.use(
  session({
    secret: "schedulezap-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }, // 24 horas
  })
);

// Inicializar banco de dados
let config = {
  evolutionApiUrl: "http://localhost:8080",
  token: "",
  instanceName: "default",
};

// Carregar configurações do banco
async function loadConfig() {
  try {
    config = await db.getConfig();
  } catch (error) {
    console.log("Erro ao carregar configurações:", error.message);
  }
}

// Função para enviar mensagem via Evolution API
async function sendMessage(phone, message) {
  try {
    console.log(`Tentando enviar mensagem para ${phone}`);
    // Codificar o nome da instância para URL (espaços viram %20)
    const encodedInstance = encodeURIComponent(config.instanceName);
    console.log(
      `URL: ${config.evolutionApiUrl}/message/sendText/${encodedInstance}`
    );
    console.log(`API Key: ${config.token ? "Presente" : "Ausente"}`);

    // Estrutura correta conforme documentação da Evolution API
    const payload = {
      number: phone,
      options: {
        delay: 1000, // Delay de 1 segundo (1000ms)
      },
      text: message, // Propriedade text diretamente no payload
    };

    console.log("Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${config.evolutionApiUrl}/message/sendText/${encodedInstance}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: config.token, // Header correto conforme documentação
        },
        timeout: 10000, // 10 segundos de timeout
      }
    );

    console.log("Resposta da Evolution API:", response.status, response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Erro detalhado ao enviar mensagem:");
    console.error("Status:", error.response?.status);
    console.error("Mensagem:", error.message);
    console.error("Resposta:", JSON.stringify(error.response?.data, null, 2));

    let errorMessage = error.message;
    if (error.response?.status === 400) {
      errorMessage =
        "Dados inválidos. Verifique o número do telefone e a mensagem.";
      if (error.response?.data?.response?.message) {
        const validationErrors = error.response.data.response.message;
        console.error("Erros de validação:", validationErrors);
        errorMessage += ` Detalhes: ${JSON.stringify(validationErrors)}`;
      }
    } else if (error.response?.status === 401) {
      errorMessage =
        "API Key inválida ou não autorizada. Verifique suas credenciais na seção Configuração.";
    } else if (error.response?.status === 404) {
      errorMessage =
        "Instância não encontrada. Verifique o nome da instância na seção Configuração.";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage =
        "Não foi possível conectar à Evolution API. Verifique se ela está rodando.";
    } else if (error.code === "ENOTFOUND") {
      errorMessage =
        "URL da Evolution API não encontrada. Verifique a URL na seção Configuração.";
    }

    return { success: false, error: errorMessage };
  }
}

// Agendador de tarefas
cron.schedule("* * * * *", async () => {
  const now = moment();

  try {
    const messages = await db.getAllMessages();

    for (const msg of messages) {
      if (moment(msg.scheduledTime).isSameOrBefore(now) && !msg.sent) {
        console.log(`Enviando mensagem agendada: ${msg.id}`);

        const result = await sendMessage(msg.phone, msg.message);

        if (result.success) {
          await db.updateMessageStatus(
            msg.id,
            true,
            new Date().toISOString(),
            null
          );
          console.log(`Mensagem ${msg.id} enviada com sucesso`);
        } else {
          await db.updateMessageStatus(msg.id, false, null, result.error);
          console.log(`Erro ao enviar mensagem ${msg.id}: ${result.error}`);
        }
      }
    }
  } catch (error) {
    console.error("Erro no agendador:", error);
  }
});

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: "Não autorizado" });
  }
}

// Rota de login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }

  try {
    const isValid = await db.authenticateUser(username, password);

    if (isValid) {
      req.session.authenticated = true;
      req.session.username = username;
      res.json({ success: true, message: "Login realizado com sucesso" });
    } else {
      res.status(401).json({ error: "Usuário ou senha inválidos" });
    }
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Rota de logout
app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logout realizado com sucesso" });
});

// Rota para verificar se está autenticado
app.get("/api/auth/status", (req, res) => {
  res.json({
    authenticated: req.session.authenticated || false,
    username: req.session.username || null,
  });
});

// Rotas da API (protegidas)

// GET - Listar mensagens agendadas
app.get("/api/messages", requireAuth, async (req, res) => {
  try {
    const messages = await db.getAllMessages();
    res.json(messages);
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Agendar nova mensagem
app.post("/api/messages", requireAuth, async (req, res) => {
  const { phone, message, scheduledTime } = req.body;

  if (!phone || !message || !scheduledTime) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  // Validar formato do número de telefone
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return res.status(400).json({
      error:
        "Número de telefone inválido. Use apenas números (ex: 5511999999999)",
    });
  }

  const newMessage = {
    id: uuidv4(),
    phone: cleanPhone,
    message,
    scheduledTime,
    createdAt: new Date().toISOString(),
    sent: false,
  };

  try {
    await db.saveMessage(newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Erro ao salvar mensagem:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE - Remover mensagem agendada
app.delete("/api/messages/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await db.deleteMessage(id);
    res.json({ message: "Mensagem removida com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar mensagem:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET - Obter configurações
app.get("/api/config", requireAuth, async (req, res) => {
  try {
    const config = await db.getConfig();
    res.json(config);
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Salvar configurações
app.post("/api/config", requireAuth, async (req, res) => {
  const { evolutionApiUrl, token, instanceName } = req.body;

  if (!evolutionApiUrl || !token || !instanceName) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  try {
    await db.saveConfig({ evolutionApiUrl, token, instanceName });
    await loadConfig(); // Recarregar configurações
    res.json({ evolutionApiUrl, token, instanceName });
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Testar conexão com Evolution API
app.post("/api/test-connection", requireAuth, async (req, res) => {
  try {
    console.log("Testando conexão com Evolution API...");
    console.log("URL:", config.evolutionApiUrl);
    console.log("Instância:", config.instanceName);
    console.log("API Key presente:", !!config.token);

    // Teste simples de conectividade usando a API correta
    const response = await axios.get(
      `${config.evolutionApiUrl}/instance/fetchInstances`,
      {
        headers: {
          apikey: config.token, // Header correto conforme documentação
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );

    console.log("Teste de conexão bem-sucedido:", response.status);
    res.json({
      success: true,
      message: "Conexão com Evolution API estabelecida com sucesso!",
    });
  } catch (error) {
    console.error("Erro no teste de conexão:", error.message);

    let errorMessage = "Erro ao conectar com Evolution API";
    if (error.response?.status === 401) {
      errorMessage = "API Key inválida ou não autorizada";
    } else if (error.response?.status === 404) {
      errorMessage = "URL da Evolution API não encontrada";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Não foi possível conectar à Evolution API";
    }

    res.status(400).json({ success: false, error: errorMessage });
  }
});

// Rota para servir o frontend
app.get("/", (req, res) => {
  if (!req.session.authenticated) {
    res.sendFile(path.join(__dirname, "public", "login.html"));
  } else {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Servir arquivos PWA
app.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "manifest.json"));
});

app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "public", "sw.js"));
});

app.get("/icons/:icon", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "icons", req.params.icon));
});

// Inicializar aplicação
async function startServer() {
  try {
    // Inicializar banco de dados
    await db.initDatabase();
    console.log("Banco de dados inicializado com sucesso");

    // Carregar configurações
    await loadConfig();
    console.log("Configurações carregadas");

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Acesse: http://localhost:${PORT}`);
      console.log("Usuário padrão: admin / Lucas4tlof!");
    });
  } catch (error) {
    console.error("Erro ao inicializar servidor:", error);
    process.exit(1);
  }
}

startServer();
