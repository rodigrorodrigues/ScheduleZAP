const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
const axios = require("axios");
const moment = require("moment");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");
const db = require("./database");
const bcrypt = require("bcryptjs"); // Adicionado para criptografia de senha

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
    resave: true,
    saveUninitialized: true,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Inicializar banco de dados
let config = {
  evolutionApiUrl: "http://localhost:8080",
  token: "",
  instanceName: "default",
};

// Cache em memória para lista de grupos da Evolution API
const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let groupsCache = {
  items: [],
  fetchedAt: 0,
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
  if (req.session.authenticated && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: "Não autorizado" });
  }
}

function requireAdmin(req, res, next) {
  if (req.session.authenticated && req.session.user?.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Acesso restrito ao administrador" });
}

// Rota de login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  }

  try {
    const user = await db.authenticateUser(username, password);

    if (user) {
      req.session.authenticated = true;
      req.session.user = user; // { id, username, role }
      res.json({ success: true, message: "Login realizado com sucesso", user });
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
    user: req.session.user || null,
  });
});

// Rotas da API (protegidas)

// Admin - Gerenciar usuários
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.listUsers();
    res.json(users);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { username, password, role, forcePasswordChange } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "username e password são obrigatórios" });
    }

    // Validações extras
    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username deve ter pelo menos 3 caracteres" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password deve ter pelo menos 6 caracteres" });
    }
    if (role && !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role deve ser 'user' ou 'admin'" });
    }

    // Verificar se username já existe
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username já existe" });
    }

    const user = await db.createUser(
      username,
      password,
      role || "user",
      forcePasswordChange
    );
    res.status(201).json(user);
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res
      .status(400)
      .json({ error: "Falha ao criar usuário", details: error.message });
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId || userId === req.session.user.id) {
      return res
        .status(400)
        .json({ error: "ID inválido ou operação não permitida" });
    }
    await db.deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    res.status(400).json({ error: "Falha ao deletar usuário" });
  }
});

// PUT - Editar usuário (role)
app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!userId || userId === req.session.user.id) {
      return res
        .status(400)
        .json({ error: "ID inválido ou operação não permitida" });
    }

    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role deve ser 'user' ou 'admin'" });
    }

    await db.updateUserRole(userId, role);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao editar usuário:", error);
    res.status(400).json({ error: "Falha ao editar usuário" });
  }
});

// PUT - Redefinir senha do usuário
app.put("/api/admin/users/:id/password", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { password, generateRandom, forcePasswordChange } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "ID inválido" });
    }

    let newPassword = password;
    let shouldForceChange = forcePasswordChange || false;

    if (generateRandom) {
      // Gerar senha aleatória
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      newPassword = "";
      for (let i = 0; i < 12; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      shouldForceChange = true;
    } else {
      if (!password || password.length < 6) {
        return res
          .status(400)
          .json({ error: "Senha deve ter pelo menos 6 caracteres" });
      }
    }

    await db.updateUserPassword(userId, newPassword, shouldForceChange);
    res.json({
      success: true,
      newPassword: generateRandom ? newPassword : undefined,
    });
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    res.status(400).json({ error: "Falha ao redefinir senha" });
  }
});

// Admin - Configuração por usuário
app.get("/api/admin/users/:id/config", requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const config = await db.getUserConfig(targetUserId);
    res.json(config);
  } catch (error) {
    console.error("Erro ao obter config do usuário:", error);
    res.status(400).json({ error: "Falha ao obter configuração" });
  }
});

app.post("/api/admin/users/:id/config", requireAdmin, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { evolutionApiUrl, token, instanceName } = req.body;
    if (!evolutionApiUrl || !token || !instanceName) {
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });
    }
    await db.saveUserConfig(targetUserId, {
      evolutionApiUrl,
      token,
      instanceName,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar config do usuário:", error);
    res.status(400).json({ error: "Falha ao salvar configuração" });
  }
});

// POST - Testar conexão da Evolution API para um usuário
app.post(
  "/api/admin/users/:id/test-connection",
  requireAdmin,
  async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.id, 10);
      const { evolutionApiUrl, token, instanceName } = req.body;

      if (!evolutionApiUrl || !token || !instanceName) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes" });
      }

      // Testar conexão com a Evolution API
      const encodedInstance = encodeURIComponent(instanceName);
      const testUrl = `${evolutionApiUrl}/instance/fetchInstances`;

      const response = await axios.get(testUrl, {
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
        timeout: 10000,
      });

      if (response.status === 200) {
        res.json({ success: true, message: "Conexão testada com sucesso" });
      } else {
        res.status(400).json({ error: "Falha na conexão com a Evolution API" });
      }
    } catch (error) {
      console.error("Erro ao testar conexão:", error);
      res.status(400).json({
        error: "Falha na conexão",
        details: error.response?.data || error.message,
      });
    }
  }
);

// Admin - Estatísticas do sistema
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const totalUsers = await db.getTotalUsers();
    const totalMessages = await db.getTotalMessages();
    const totalAdmins = await db.getTotalAdmins();

    res.json({
      totalUsers,
      totalMessages,
      totalAdmins,
      systemInfo: {
        version: "2.0.0",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    });
  } catch (error) {
    console.error("Erro ao obter estatísticas:", error);
    res.status(500).json({ error: "Falha ao obter estatísticas" });
  }
});

// GET - Listar mensagens agendadas
app.get("/api/messages", requireAuth, async (req, res) => {
  try {
    console.log("Buscando mensagens agendadas...");
    const messages = await db.getMessagesByUser(req.session.user.id);
    console.log(`Encontradas ${messages.length} mensagens:`, messages);
    res.json(messages);
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Agendar nova mensagem
app.post("/api/messages", requireAuth, async (req, res) => {
  const { phone, message, scheduledTime } = req.body;

  console.log("Recebendo dados para agendamento:", {
    phone,
    message,
    scheduledTime,
  });

  if (!phone || !message || !scheduledTime) {
    console.log("Dados obrigatórios faltando");
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  // Aceitar JID de grupo (termina com @g.us) ou número limpo (10-15 dígitos)
  let destination = phone;
  if (typeof phone === "string" && phone.includes("@g.us")) {
    destination = phone; // grupo
  } else {
    const cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      console.log("Número de telefone inválido:", cleanPhone);
      return res.status(400).json({
        error:
          "Número de telefone inválido. Use apenas números (ex: 5511999999999)",
      });
    }
    destination = cleanPhone;
  }

  const newMessage = {
    id: uuidv4(),
    phone: destination,
    message,
    scheduledTime,
    createdAt: new Date().toISOString(),
    sent: false,
    userId: req.session.user.id,
  };

  console.log("Mensagem a ser salva:", newMessage);

  try {
    await db.saveMessage(newMessage);
    console.log("Mensagem salva com sucesso:", newMessage.id);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Erro ao salvar mensagem:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE - Remover mensagem agendada
app.delete("/api/messages/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  console.log("Tentando deletar mensagem:", id);

  try {
    await db.deleteMessage(id);
    console.log("Mensagem deletada com sucesso:", id);
    res.json({ message: "Mensagem removida com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar mensagem:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET - Obter configurações (por usuário)
app.get("/api/config", requireAuth, async (req, res) => {
  try {
    const config = await db.getUserConfig(req.session.user.id);
    res.json(config);
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Salvar configurações (por usuário)
app.post("/api/config", requireAuth, async (req, res) => {
  const { evolutionApiUrl, token, instanceName } = req.body;

  if (!evolutionApiUrl || !token || !instanceName) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  try {
    await db.saveUserConfig(req.session.user.id, {
      evolutionApiUrl,
      token,
      instanceName,
    });
    await loadConfig(); // Recarregar configurações globais (mantido)
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

// GET - Limpar cache e verificar configuração
app.get("/api/config/clear-cache", requireAuth, async (req, res) => {
  try {
    // Forçar recarregamento das configurações
    await loadConfig();
    res.json({ success: true, message: "Cache limpo com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao limpar cache" });
  }
});

// GET - Verificar status da configuração
app.get("/api/config/status", requireAuth, async (req, res) => {
  try {
    const userConfig = await db.getUserConfig(req.session.user.id);
    const hasConfig = !!(
      userConfig.evolutionApiUrl &&
      userConfig.instanceName &&
      userConfig.token
    );
    res.json({
      hasConfig,
      evolutionApiUrl: userConfig.evolutionApiUrl || null,
      instanceName: userConfig.instanceName || null,
      hasToken: !!userConfig.token,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao verificar configuração" });
  }
});

// Função para deduplicar contatos
function deduplicateChats(chats) {
  console.log("Deduplicando chats...");
  const uniqueChats = new Map();

  chats.forEach((chat, index) => {
    const key = chat.id || chat.remoteJid || chat.chatId;
    if (key && !uniqueChats.has(key)) {
      uniqueChats.set(key, chat);
    } else if (key) {
      console.log(`Chat duplicado removido: ${chat.name} (${key})`);
    }
  });

  const deduplicatedChats = Array.from(uniqueChats.values());
  console.log(
    `Deduplicação: ${chats.length} -> ${deduplicatedChats.length} chats`
  );
  return deduplicatedChats;
}

// Função para formatar nomes de contatos
function formatContactName(chat) {
  // Heurística de grupo
  const isGroup =
    (chat.type && String(chat.type).toLowerCase() === "group") ||
    (chat.id && chat.id.includes("@g.us"));

  if (isGroup) {
    return chat.name && chat.name !== "Sem nome" ? chat.name : "Grupo sem nome";
  }

  // Tentar extrair número de telefone do id
  const rawId = chat.id || "";
  let phoneNumber = null;
  if (rawId.includes("@s.whatsapp.net")) {
    phoneNumber = rawId.split("@")[0];
  } else {
    const digits = (rawId.match(/\d+/g) || []).join("");
    if (digits.length >= 10 && digits.length <= 15) {
      phoneNumber = digits;
    }
  }

  // Se já tem um nome, checar se não é um id opaco igual ao id
  const nameCandidate = chat.name || "";
  const looksOpaqueId =
    !nameCandidate.includes(" ") &&
    /[a-zA-Z]/.test(nameCandidate) &&
    nameCandidate.length >= 16 &&
    nameCandidate === rawId;

  if (nameCandidate && nameCandidate !== "Sem nome" && !looksOpaqueId) {
    return nameCandidate;
  }

  // Usar telefone se disponível
  if (phoneNumber) {
    if (phoneNumber.length === 13 && phoneNumber.startsWith("55")) {
      return `+${phoneNumber.substring(0, 2)} (${phoneNumber.substring(
        2,
        4
      )}) ${phoneNumber.substring(4, 9)}-${phoneNumber.substring(9)}`;
    }
    return phoneNumber;
  }

  // Fallback
  return "Contato sem nome";
}

// Função para ordenar chats por atividade
function sortChatsByActivity(chats) {
  return chats.sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
    const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
    return dateB - dateA; // Mais recente primeiro
  });
}

// Função auxiliar para validar e normalizar dados da Evolution API v2
function normalizeEvolutionV2Data(data) {
  console.log("Normalizando dados da Evolution API v2:", data);

  let chats = [];

  // Verificar diferentes estruturas de resposta
  if (Array.isArray(data)) {
    chats = data;
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.chats)) {
      chats = data.chats;
    } else if (Array.isArray(data.data)) {
      chats = data.data;
    } else if (Array.isArray(data.response)) {
      chats = data.response;
    } else if (Array.isArray(data.result)) {
      chats = data.result;
    } else if (data.chats && typeof data.chats === "object") {
      // Se chats for um objeto com propriedades, converter para array
      chats = Object.values(data.chats);
    } else {
      console.log("Estrutura de dados não reconhecida:", data);
      return [];
    }
  }

  console.log(`Extraídos ${chats.length} chats da resposta`);

  // Normalizar cada chat
  const normalizedChats = chats
    .map((chat, index) => {
      if (!chat || typeof chat !== "object") {
        console.log(`Chat inválido no índice ${index}:`, chat);
        return null;
      }

      // Extrair ID do chat (preferir remoteJid quando disponível, pois contém o domínio @)
      const chatId =
        chat.remoteJid || chat.id || chat.chatId || chat.jid || chat._id;
      const remoteJid = chat.remoteJid || chat.jid || null;

      // Determinar tipo (heurística mais robusta)
      const rawIsGroupFlag =
        chat.isGroup === true ||
        chat.group === true ||
        chat.isGroupChat === true ||
        chat.isGroup?.toString?.() === "true" ||
        typeof chat.participantsCount === "number" ||
        Array.isArray(chat.participants) ||
        !!chat.subject ||
        (remoteJid && String(remoteJid).includes("@g.us"));

      const isGroup =
        rawIsGroupFlag || (chatId && String(chatId).includes("@g.us"));

      // Extrair nome do chat
      const rawChatName =
        chat.name ||
        chat.pushName ||
        chat.subject ||
        chat.title ||
        chat.displayName ||
        chat.contactName ||
        chat.notifyName ||
        (chatId && !isGroup && String(chatId).includes("@")
          ? chatId.split("@")[0]
          : "Sem nome");

      // Extrair informações adicionais
      const profilePic =
        chat.profilePicUrl ||
        chat.pictureUrl ||
        chat.profilePic ||
        chat.picture ||
        chat.avatar ||
        null;

      const updatedAt =
        chat.updatedAt ||
        chat.timestamp ||
        chat.lastMessageTimestamp ||
        chat.lastActivity ||
        chat.modifiedAt ||
        null;

      const normalizedChat = {
        id: chatId,
        name: rawChatName,
        profilePicUrl: profilePic,
        updatedAt: updatedAt,
        type: isGroup ? "group" : "individual",
      };

      // Adicionar informações específicas de grupos
      if (isGroup) {
        normalizedChat.size =
          chat.size || chat.participantsCount || chat.memberCount || null;
        normalizedChat.owner =
          chat.owner || chat.ownerId || chat.ownerJid || null;
        normalizedChat.desc =
          chat.desc || chat.description || chat.subject || null;
      }

      return normalizedChat;
    })
    .filter((chat) => chat && chat.id); // Filtrar apenas se houver ID

  console.log(`Normalizados ${normalizedChats.length} chats válidos`);
  return normalizedChats;
}

// Função auxiliar para normalizar grupos da Evolution API v2
function normalizeEvolutionV2Groups(data) {
  console.log("Normalizando dados de grupos da Evolution API v2:", data);

  let groups = [];

  if (Array.isArray(data)) {
    groups = data;
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.groups)) {
      groups = data.groups;
    } else if (Array.isArray(data.data)) {
      groups = data.data;
    } else if (Array.isArray(data.response)) {
      groups = data.response;
    } else if (Array.isArray(data.result)) {
      groups = data.result;
    } else {
      groups = Object.values(data);
    }
  }

  const normalized = groups
    .map((g, index) => {
      if (!g || typeof g !== "object") return null;
      const rawId = g.id || g.jid || g.groupId;
      if (!rawId) return null;
      const id = String(rawId).includes("@") ? String(rawId) : `${rawId}@g.us`;

      const name =
        g.subject || g.name || g.title || g.displayName || "Grupo sem nome";
      const profilePicUrl = g.pictureUrl || g.profilePicUrl || null;
      const updatedAt = g.subjectTime || g.creation || null;

      return {
        id,
        name,
        profilePicUrl,
        updatedAt,
        type: "group",
        size: g.size || null,
        owner: g.owner || null,
        desc: g.desc || null,
      };
    })
    .filter((g) => g && g.id);

  console.log(`Normalizados ${normalized.length} grupos válidos`);
  return normalized;
}

// Função auxiliar para normalizar contatos (findContacts) da Evolution API v2
function normalizeEvolutionV2Contacts(data) {
  console.log(
    "Normalizando dados de contatos (findContacts) da Evolution API v2:",
    data
  );

  let items = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object") {
    if (Array.isArray(data.data)) {
      items = data.data;
    } else if (Array.isArray(data.response)) {
      items = data.response;
    } else if (Array.isArray(data.result)) {
      items = data.result;
    } else {
      items = Object.values(data);
    }
  }

  const normalized = items
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const remoteJid = c.remoteJid || c.jid || null;
      if (!remoteJid) return null;

      const isGroup = String(remoteJid).includes("@g.us");

      const nameCandidate =
        c.pushName ||
        c.name ||
        c.subject ||
        (remoteJid && !isGroup && String(remoteJid).includes("@")
          ? String(remoteJid).split("@")[0]
          : "Sem nome");

      const profilePicUrl = c.profilePicUrl || c.pictureUrl || null;
      const updatedAt = c.updatedAt || c.createdAt || null;

      return {
        id: remoteJid,
        name: nameCandidate,
        profilePicUrl,
        updatedAt,
        type: isGroup ? "group" : "individual",
      };
    })
    .filter((i) => i && i.id);

  console.log(`Normalizados ${normalized.length} itens de contatos válidos`);
  return normalized;
}

// GET - Buscar conversas da Evolution API v2
app.get("/api/chats", requireAuth, async (req, res) => {
  try {
    console.log("Buscando conversas da Evolution API v2...");
    const userConfig = await db.getUserConfig(req.session.user.id);
    console.log("Configuração atual:", {
      evolutionApiUrl: userConfig.evolutionApiUrl,
      instanceName: userConfig.instanceName,
      hasToken: !!userConfig.token,
    });

    // Verificar se a configuração está completa
    if (
      !userConfig.evolutionApiUrl ||
      !userConfig.instanceName ||
      !userConfig.token
    ) {
      console.log("Configuração incompleta");
      return res.status(400).json({
        success: false,
        error:
          "Configuração da Evolution API incompleta. Configure a API primeiro.",
      });
    }

    // Codificar o nome da instância para URL
    const encodedInstance = encodeURIComponent(userConfig.instanceName);

    // Pegar parâmetros de paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    console.log(`Buscando página ${page} com ${limit} itens por página...`);

    // Checar cache (a menos que o cliente peça refresh)
    const refresh =
      String(req.query.refresh || "false").toLowerCase() === "true";
    const now = Date.now();
    const cacheAge = now - groupsCache.fetchedAt;
    if (
      !refresh &&
      groupsCache.items &&
      groupsCache.items.length > 0 &&
      cacheAge < GROUPS_CACHE_TTL_MS
    ) {
      console.log(
        `Servindo grupos do cache (${
          groupsCache.items.length
        } itens, idade ${Math.round(cacheAge / 1000)}s)`
      );
      const totalFound = groupsCache.items.length;
      return res.json({
        success: true,
        chats: groupsCache.items,
        currentPage: 1,
        hasMore: false,
        totalInPage: totalFound,
        totalFound,
        cache: { ttlMs: GROUPS_CACHE_TTL_MS, ageMs: cacheAge },
      });
    }

    try {
      // Usar exclusivamente o endpoint de grupos: fetchAllGroups
      const response = await axios.get(
        `${userConfig.evolutionApiUrl}/group/fetchAllGroups/${encodedInstance}?getParticipants=false`,
        {
          headers: {
            apikey: userConfig.token,
          },
          timeout: 60000,
        }
      );

      console.log(
        "Resposta da Evolution API v2 (fetchAllGroups):",
        response.status
      );

      if (!response.data) {
        throw new Error("Resposta vazia da API");
      }

      // Normalizar grupos (subject -> name)
      let allGroups = normalizeEvolutionV2Groups(response.data);

      // Deduplicar, ordenar e formatar nomes
      allGroups = deduplicateChats(allGroups);
      allGroups = sortChatsByActivity(allGroups);
      allGroups = allGroups.map((chat) => ({
        ...chat,
        name: formatContactName(chat),
      }));

      // Atualizar cache
      groupsCache = {
        items: allGroups,
        fetchedAt: Date.now(),
      };

      // Sem paginação: retornar todos os grupos de uma vez
      const totalFound = allGroups.length;
      return res.json({
        success: true,
        chats: allGroups,
        currentPage: 1,
        hasMore: false,
        totalInPage: totalFound,
        totalFound,
      });
    } catch (apiError) {
      console.error(
        "Erro na chamada fetchAllGroups da Evolution API v2:",
        apiError.message
      );
      console.error("Status:", apiError.response?.status);
      console.error("Dados do erro:", apiError.response?.data);
      throw apiError;
    }
  } catch (error) {
    console.error("Erro ao buscar conversas:", error.message);
    console.error("Detalhes do erro:", {
      status: error.response?.status,
      data: error.response?.data,
      code: error.code,
    });

    let errorMessage = "Erro ao buscar conversas";
    if (error.response?.status === 401) {
      errorMessage = "API Key inválida ou não autorizada";
    } else if (error.response?.status === 404) {
      errorMessage =
        "Instância não encontrada. Verifique se o nome da instância está correto.";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Não foi possível conectar à Evolution API";
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || error.message,
    });
  }
});

// GET - Testar conexão com Evolution API v2
app.get("/api/evolution/test", requireAuth, async (req, res) => {
  try {
    console.log("Testando conexão com Evolution API v2...");

    if (!config.evolutionApiUrl || !config.instanceName || !config.token) {
      return res.status(400).json({
        success: false,
        error: "Configuração incompleta da Evolution API",
      });
    }

    const encodedInstance = encodeURIComponent(config.instanceName);

    // Testar primeiro o status da instância
    try {
      const instanceResponse = await axios.get(
        `${config.evolutionApiUrl}/instance/fetchInstances`,
        {
          headers: {
            apikey: config.token,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("Status das instâncias:", instanceResponse.data);

      // Verificar se a instância existe
      const instances = Array.isArray(instanceResponse.data)
        ? instanceResponse.data
        : [];
      const targetInstance = instances.find((inst) => {
        const instanceName =
          inst.instance?.instanceName || inst.instanceName || inst.name;
        return instanceName === config.instanceName;
      });

      if (!targetInstance) {
        return res.status(404).json({
          success: false,
          error: `Instância '${config.instanceName}' não encontrada`,
          availableInstances: instances.map(
            (inst) =>
              inst.instance?.instanceName || inst.instanceName || inst.name
          ),
        });
      }

      // Testar o endpoint de chats
      const chatsResponse = await axios.post(
        `${config.evolutionApiUrl}/chat/findChats/${encodedInstance}`,
        {
          page: 1,
          limit: 5,
        },
        {
          headers: {
            apikey: config.token,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      const testChats = normalizeEvolutionV2Data(chatsResponse.data);

      return res.json({
        success: true,
        message: "Conexão com Evolution API v2 estabelecida com sucesso",
        instance: {
          name: config.instanceName,
          status: "connected",
          foundChats: testChats.length,
        },
        apiInfo: {
          url: config.evolutionApiUrl,
          version: "v2",
          hasToken: !!config.token,
        },
        testData: {
          totalInstances: instances.length,
          testChatsCount: testChats.length,
        },
      });
    } catch (apiError) {
      console.error("Erro ao testar Evolution API v2:", apiError.message);

      return res.status(400).json({
        success: false,
        error: "Falha na conexão com Evolution API v2",
        details: {
          message: apiError.message,
          status: apiError.response?.status,
          data: apiError.response?.data,
        },
      });
    }
  } catch (error) {
    console.error("Erro geral no teste:", error.message);
    res.status(500).json({
      success: false,
      error: "Erro interno no teste de conexão",
      details: error.message,
    });
  }
});

// POST - Alterar senha do usuário logado
app.post("/api/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Senha atual e nova senha são obrigatórias" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Nova senha deve ter pelo menos 6 caracteres" });
    }

    // Verificar se a senha atual está correta
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Senha atual incorreta" });
    }

    // Alterar senha e limpar flag de força de alteração
    await db.updateUserPassword(userId, newPassword, false);
    await db.clearForcePasswordChange(userId);

    res.json({ success: true, message: "Senha alterada com sucesso" });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
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

// Rota para ícones removida para evitar erros

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
