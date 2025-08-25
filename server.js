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

// Middleware para prevenir cache nas APIs
app.use("/api", (req, res, next) => {
  res.set({
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  next();
});

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

// Cache em memória para lista de grupos da Evolution API
const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let groupsCache = {
  items: [],
  fetchedAt: 0,
};

// Função para enviar mensagem via Evolution API
async function sendMessage(phone, message, userId) {
  try {
    console.log(`Tentando enviar mensagem para ${phone}`);

    // Obter instância do usuário
    const userInstance = await db.getUserInstanceData(userId);
    if (!userInstance?.instance_name) {
      return {
        success: false,
        error:
          "Nenhuma instância configurada. Configure uma instância primeiro.",
      };
    }

    // Obter configuração global da Evolution API
    const config = await db.getGlobalConfig();
    if (!config) {
      return {
        success: false,
        error: "Configuração da Evolution API não encontrada.",
      };
    }

    // Codificar o nome da instância para URL (espaços viram %20)
    const encodedInstance = encodeURIComponent(userInstance.instance_name);
    console.log(
      `URL: ${config.evolution_api_url}/message/sendText/${encodedInstance}`
    );
    console.log(
      `API Key: ${config.evolution_api_token ? "Presente" : "Ausente"}`
    );

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
      `${config.evolution_api_url}/message/sendText/${encodedInstance}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          apikey: config.evolution_api_token, // Header correto conforme documentação
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
        "API Key inválida ou não autorizada. Verifique suas credenciais na seção Instâncias.";
    } else if (error.response?.status === 404) {
      errorMessage =
        "Instância não encontrada. Verifique o nome da instância na seção Instâncias.";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage =
        "Não foi possível conectar à Evolution API. Verifique se ela está rodando.";
    } else if (error.code === "ENOTFOUND") {
      errorMessage =
        "URL da Evolution API não encontrada. Verifique a URL na seção Instâncias.";
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

        const result = await sendMessage(msg.phone, msg.message, msg.user_id);

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
app.get("/api/auth/status", async (req, res) => {
  try {
    if (req.session.authenticated && req.session.user) {
      // Verificar se o usuário precisa alterar a senha
      const forcePasswordChange = await db.checkForcePasswordChange(
        req.session.user.id
      );
      res.json({
        authenticated: true,
        user: {
          ...req.session.user,
          forcePasswordChange,
        },
      });
    } else {
      res.json({
        authenticated: false,
        user: null,
      });
    }
  } catch (error) {
    console.error("Erro ao verificar status de autenticação:", error);
    res.json({
      authenticated: req.session.authenticated || false,
      user: req.session.user || null,
    });
  }
});

// Rotas da API (protegidas)

// Admin - Testar configuração da Evolution API
app.post("/api/admin/config/test", requireAdmin, async (req, res) => {
  try {
    const { evolution_api_url, evolution_api_token } = req.body;
    if (!evolution_api_url || !evolution_api_token) {
      return res.status(400).json({ error: "URL e token são obrigatórios" });
    }

    // Testar conexão com a Evolution API
    try {
      const baseUrl = evolution_api_url.replace(/\/+$/, "");
      const response = await axios.get(`${baseUrl}/instance/fetchInstances`, {
        headers: {
          apikey: evolution_api_token,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });

      if (response.status !== 200) {
        return res
          .status(400)
          .json({ error: "Falha na conexão com a Evolution API" });
      }

      res.json({
        success: true,
        message: "Conexão estabelecida com sucesso",
        instances: response.data,
      });
    } catch (error) {
      console.error("Erro ao testar Evolution API:", error);
      return res.status(400).json({
        error: "Falha na conexão com a Evolution API",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("Erro ao testar configuração:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Admin - Configuração global da Evolution API
app.get("/api/admin/config", requireAdmin, async (req, res) => {
  try {
    const config = await db.getGlobalConfig();
    res.json(config || {});
  } catch (error) {
    console.error("Erro ao obter configuração global:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.post("/api/admin/config", requireAdmin, async (req, res) => {
  try {
    const { evolution_api_url, evolution_api_token } = req.body;
    if (!evolution_api_url || !evolution_api_token) {
      return res.status(400).json({ error: "URL e token são obrigatórios" });
    }

    // Testar conexão com a Evolution API
    try {
      console.log("Testando conexão com Evolution API:", evolution_api_url);

      // Primeiro tenta um health check
      try {
        // Garantir que a URL não termine com barra
        const baseUrl = evolution_api_url.replace(/\/+$/, "");

        const pingResponse = await axios.get(`${baseUrl}/`, {
          headers: {
            apikey: evolution_api_token,
            "Content-Type": "application/json",
          },
          timeout: 5000,
        });

        console.log(
          "Resposta do ping:",
          pingResponse.status,
          pingResponse.data
        );

        if (pingResponse.status !== 200) {
          return res
            .status(400)
            .json({ error: "Evolution API não está respondendo" });
        }
      } catch (pingError) {
        console.error(
          "Erro no ping:",
          pingError.response?.data || pingError.message
        );
        return res.status(400).json({
          error: "Evolution API não está acessível",
          details: pingError.response?.data?.error || pingError.message,
        });
      }

      // Se o health check funcionou, tenta listar as instâncias
      try {
        // Garantir que a URL não termine com barra
        const baseUrl = evolution_api_url.replace(/\/+$/, "");
        const response = await axios.get(`${baseUrl}/instance/fetchInstances`, {
          headers: {
            apikey: evolution_api_token,
            "Content-Type": "application/json",
          },
          timeout: 5000,
        });

        console.log(
          "Resposta do fetchInstances:",
          response.status,
          response.data
        );

        if (response.status !== 200) {
          return res
            .status(400)
            .json({ error: "Falha ao listar instâncias na Evolution API" });
        }

        return res.json({
          success: true,
          message: "Conexão estabelecida com sucesso",
          instances: response.data,
        });
      } catch (instancesError) {
        console.error(
          "Erro ao listar instâncias:",
          instancesError.response?.data || instancesError.message
        );
        return res.status(400).json({
          error: "Falha ao listar instâncias",
          details:
            instancesError.response?.data?.error || instancesError.message,
        });
      }
    } catch (error) {
      console.error("Erro geral ao testar Evolution API:", error);
      return res.status(400).json({
        error: "Falha na conexão com a Evolution API",
        details: error.response?.data?.error || error.message,
      });
    }

    await db.saveGlobalConfig({ evolution_api_url, evolution_api_token });
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao salvar configuração global:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Usuário - Gerenciar instância
app.get("/api/instance", requireAuth, async (req, res) => {
  try {
    console.log("Buscando instância para usuário ID:", req.session.user.id);
    const instance = await db.getUserInstanceData(req.session.user.id);
    console.log("Instância encontrada no banco:", instance);

    if (!instance?.instance_name) {
      console.log("Nenhuma instância encontrada, retornando not_created");
      return res.json({
        instance_name: null,
        instance_connected: false,
        instance_qr_code: null,
        instance_status: "not_created",
      });
    }

    // Obter configuração global
    const config = await db.getGlobalConfig();
    if (!config) {
      return res.json(instance);
    }

    // Verificar status na Evolution API
    try {
      const response = await axios.get(
        `${config.evolution_api_url}/instance/connectionState/${instance.instance_name}`,
        {
          headers: {
            apikey: config.evolution_api_token,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 200) {
        console.log(
          "Resposta da Evolution API connectionState:",
          JSON.stringify(response.data, null, 2)
        );

        // A Evolution API retorna o status em diferentes formatos dependendo da versão
        // Vamos tentar múltiplos caminhos possíveis
        const status =
          response.data.instance?.state ||
          response.data.instance?.status ||
          response.data.state ||
          response.data.status ||
          "disconnected";

        const connected =
          status === "CONNECTED" ||
          status === "OPEN" ||
          status === "open" ||
          status === "connected";

        // Verificar se o status é "close" ou "CLOSE" e tratar como desconectado
        if (status === "close" || status === "CLOSE") {
          console.log("Status detectado como CLOSE - instância desconectada");
        }

        console.log("Status extraído:", status, "Conectado:", connected);
        console.log(
          "Resposta completa da Evolution API:",
          JSON.stringify(response.data, null, 2)
        );

        // Atualizar status no banco
        await db.updateUserInstance(req.session.user.id, {
          ...instance,
          instance_connected: connected,
          instance_status: status,
        });

        // Retornar dados atualizados
        const responseData = {
          ...instance,
          instance_connected: connected,
          instance_status: status,
        };
        console.log(
          "Retornando dados da instância:",
          JSON.stringify(responseData, null, 2)
        );
        res.json(responseData);
      } else {
        res.json(instance);
      }
    } catch (error) {
      console.error("Erro ao verificar status na Evolution API:", error);
      // Retornar dados do banco mesmo com erro na API
      res.json(instance);
    }
  } catch (error) {
    console.error("Erro ao obter instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.post("/api/instance/create", requireAuth, async (req, res) => {
  try {
    // Verificar se já tem instância
    const existingInstance = await db.getUserInstanceData(req.session.user.id);
    if (existingInstance?.instance_name) {
      return res.status(400).json({ error: "Usuário já possui uma instância" });
    }

    // Obter configuração global
    const config = await db.getGlobalConfig();
    if (!config) {
      return res
        .status(400)
        .json({ error: "Configuração global não encontrada" });
    }

    // Gerar nome da instância
    const instanceName = db.generateInstanceName(req.session.user.username);

    // Criar instância na Evolution API
    try {
      // Garantir que a URL não termine com barra
      const baseUrl = config.evolution_api_url.replace(/\/+$/, "");

      console.log("Criando instância na Evolution API:", {
        url: baseUrl,
        instanceName,
      });

      // Primeiro verifica se a instância já existe
      try {
        const checkResponse = await axios.get(
          `${baseUrl}/instance/connectionState/${instanceName}`,
          {
            headers: {
              apikey: config.evolution_api_token,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Estado da instância:", checkResponse.data);

        if (checkResponse.status === 200) {
          // Se a instância existe, deleta primeiro
          await axios.delete(`${baseUrl}/instance/delete/${instanceName}`, {
            headers: {
              apikey: config.evolution_api_token,
              "Content-Type": "application/json",
            },
          });
          console.log("Instância existente deletada");
        }
      } catch (checkError) {
        // Ignora erro 404 (instância não existe)
        if (checkError.response?.status !== 404) {
          console.error(
            "Erro ao verificar instância:",
            checkError.response?.data || checkError.message
          );
        }
      }

      // Cria a nova instância
      const response = await axios.post(
        `${baseUrl}/instance/create`,
        {
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        },
        {
          headers: {
            apikey: config.evolution_api_token,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 segundos
        }
      );

      console.log("Resposta da criação:", response.status, response.data);

      if (response.status !== 201 && response.status !== 200) {
        throw new Error(
          `Falha ao criar instância na Evolution API: ${
            response.data?.error || response.statusText
          }`
        );
      }

      // Salvar instância no banco
      const instanceStatus = response.data.instance?.status || "connecting";
      console.log("Status da instância criada:", instanceStatus);
      console.log("Salvando instância para usuário ID:", req.session.user.id);

      await db.updateUserInstance(req.session.user.id, {
        instance_name: instanceName,
        instance_connected: false,
        instance_qr_code: response.data.qrcode?.base64 || "",
        instance_status: instanceStatus,
      });

      console.log("Instância salva no banco com sucesso");

      return res.json({
        success: true,
        instanceName,
        qrCode: response.data.qrcode.base64,
      });
    } catch (error) {
      console.error(
        "Erro ao criar instância na Evolution API:",
        error.response?.data || error
      );
      return res.status(400).json({
        error: "Falha ao criar instância na Evolution API",
        details: error.response?.data?.error || error.message,
      });
    }
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

app.get("/api/instance/status", requireAuth, async (req, res) => {
  try {
    // Obter instância do usuário
    const instance = await db.getUserInstanceData(req.session.user.id);
    if (!instance?.instance_name) {
      return res.status(400).json({ error: "Instância não encontrada" });
    }

    // Obter configuração global
    const config = await db.getGlobalConfig();
    if (!config) {
      return res
        .status(400)
        .json({ error: "Configuração global não encontrada" });
    }

    // Verificar status na Evolution API
    try {
      const response = await axios.get(
        `${config.evolution_api_url}/instance/connectionState/${instance.instance_name}`,
        {
          headers: {
            apikey: config.evolution_api_token,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status !== 200) {
        throw new Error("Falha ao obter status");
      }

      const status = response.data.instance?.state;
      const connected = status === "CONNECTED" || status === "OPEN";

      // Atualizar status no banco
      await db.updateUserInstance(req.session.user.id, {
        ...instance,
        instance_connected: connected,
        instance_status: status,
      });

      res.json({ status, connected });
    } catch (error) {
      console.error("Erro ao obter status:", error);
      return res.status(400).json({
        error: "Falha ao obter status",
        details: error.message,
      });
    }
  } catch (error) {
    console.error("Erro ao obter status:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE - Desconectar instância do usuário
app.delete("/api/instance", requireAuth, async (req, res) => {
  try {
    // Obter instância do usuário
    const instance = await db.getUserInstanceData(req.session.user.id);
    if (!instance?.instance_name) {
      return res.status(400).json({ error: "Instância não encontrada" });
    }

    // Obter configuração global
    const config = await db.getGlobalConfig();
    if (!config) {
      return res
        .status(400)
        .json({ error: "Configuração global não encontrada" });
    }

    // Deletar instância na Evolution API
    try {
      const baseUrl = config.evolution_api_url.replace(/\/+$/, "");
      const encodedInstance = encodeURIComponent(instance.instance_name);

      console.log(
        "Deletando instância na Evolution API:",
        instance.instance_name
      );

      const response = await axios.delete(
        `${baseUrl}/instance/delete/${encodedInstance}`,
        {
          headers: {
            apikey: config.evolution_api_token,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("Instância deletada na Evolution API:", response.status);
    } catch (error) {
      console.error("Erro ao deletar instância na Evolution API:", error);
      // Continuar mesmo se falhar na Evolution API
    }

    // Limpar dados da instância no banco
    await db.updateUserInstance(req.session.user.id, {
      instance_name: null,
      instance_connected: false,
      instance_qr_code: null,
      instance_status: "not_created",
    });

    res.json({ success: true, message: "Instância desconectada com sucesso" });
  } catch (error) {
    console.error("Erro ao desconectar instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

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
    const { username, role, forcePasswordChange } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username é obrigatório" });
    }

    // Validações extras
    if (username.length < 3) {
      return res
        .status(400)
        .json({ error: "Username deve ter pelo menos 3 caracteres" });
    }
    if (role && !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role deve ser 'user' ou 'admin'" });
    }

    // Verificar se username já existe
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username já existe" });
    }

    // Gerar senha aleatória
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const user = await db.createUser(
      username,
      password,
      role || "user",
      true // Sempre forçar mudança de senha no primeiro login
    );

    res.status(201).json({
      ...user,
      temporaryPassword: password,
    });
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

  // Verificar se há uma instância configurada
  const userInstance = await db.getUserInstanceData(req.session.user.id);
  if (!userInstance?.instance_name) {
    return res.status(400).json({
      error: "Nenhuma instância configurada. Configure uma instância primeiro.",
    });
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
    instanceId: null, // Não precisamos do instanceId para o sistema atual
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

// GET - Obter instâncias do usuário
app.get("/api/instances", requireAuth, async (req, res) => {
  try {
    const instances = await db.getUserInstances(req.session.user.id);
    res.json(instances);
  } catch (error) {
    console.error("Erro ao buscar instâncias:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET - Obter instância específica
app.get("/api/instances/:id", requireAuth, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id, 10);
    const instance = await db.getUserInstance(req.session.user.id, instanceId);
    if (!instance) {
      return res.status(404).json({ error: "Instância não encontrada" });
    }
    res.json(instance);
  } catch (error) {
    console.error("Erro ao buscar instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Criar nova instância
app.post("/api/instances", requireAuth, async (req, res) => {
  const { name, evolutionApiUrl, token, instanceName } = req.body;

  if (!name || !evolutionApiUrl || !token || !instanceName) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  try {
    const newInstance = await db.createUserInstance(req.session.user.id, {
      name,
      evolutionApiUrl,
      token,
      instanceName,
    });
    res.status(201).json(newInstance);
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// PUT - Atualizar instância
app.put("/api/instances/:id", requireAuth, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id, 10);
    const { name, evolutionApiUrl, token, instanceName } = req.body;

    if (!name || !evolutionApiUrl || !token || !instanceName) {
      return res
        .status(400)
        .json({ error: "Todos os campos são obrigatórios" });
    }

    await db.updateUserInstance(req.session.user.id, instanceId, {
      name,
      evolutionApiUrl,
      token,
      instanceName,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE - Deletar instância
app.delete("/api/instances/:id", requireAuth, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id, 10);
    await db.deleteUserInstance(req.session.user.id, instanceId);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Definir instância ativa
app.post("/api/instances/:id/activate", requireAuth, async (req, res) => {
  try {
    const instanceId = parseInt(req.params.id, 10);
    await db.setActiveInstance(req.session.user.id, instanceId);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao ativar instância:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET - Obter instância ativa
app.get("/api/instances/active", requireAuth, async (req, res) => {
  try {
    const userInstance = await db.getUserInstanceData(req.session.user.id);
    res.json(userInstance);
  } catch (error) {
    console.error("Erro ao buscar instância ativa:", error);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST - Testar conexão com Evolution API
app.post("/api/evolution/test", requireAuth, async (req, res) => {
  try {
    const { evolutionApiUrl, token, instanceName } = req.body;

    if (!evolutionApiUrl || !token || !instanceName) {
      return res
        .status(400)
        .json({ error: "Todos os campos são obrigatórios" });
    }

    console.log("Testando conexão com Evolution API...");
    console.log("URL:", evolutionApiUrl);
    console.log("Instância:", instanceName);
    console.log("API Key presente:", !!token);

    // Teste simples de conectividade usando a API correta
    const response = await axios.get(
      `${evolutionApiUrl}/instance/fetchInstances`,
      {
        headers: {
          apikey: token, // Header correto conforme documentação
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

// Funções complexas removidas - processamento simplificado

// Funções de normalização removidas - processamento simplificado na rota /api/chats

// GET - Buscar conversas/grupos da Evolution API v2
app.get("/api/chats", requireAuth, async (req, res) => {
  try {
    // Obter instância do usuário
    const userInstance = await db.getUserInstanceData(req.session.user.id);
    if (!userInstance?.instance_name) {
      return res.status(400).json({
        success: false,
        error:
          "Nenhuma instância configurada. Configure uma instância primeiro.",
      });
    }

    // Obter configuração global da Evolution API
    const config = await db.getGlobalConfig();
    if (!config) {
      return res.status(400).json({
        success: false,
        error: "Configuração da Evolution API não encontrada.",
      });
    }

    const encodedInstance = encodeURIComponent(userInstance.instance_name);
    const refresh = req.query.refresh === "true";

    // Verificar cache se não for refresh
    if (!refresh && groupsCache && groupsCache.items) {
      const cacheAge = Date.now() - groupsCache.fetchedAt;
      if (cacheAge < GROUPS_CACHE_TTL_MS) {
        return res.json({
          success: true,
          chats: groupsCache.items,
          currentPage: 1,
          hasMore: false,
          totalInPage: groupsCache.items.length,
          totalFound: groupsCache.items.length,
          cache: { ttlMs: GROUPS_CACHE_TTL_MS, ageMs: cacheAge },
        });
      }
    }

    console.log("Buscando grupos da Evolution API v2...");
    console.log("Instância configurada:", {
      instanceName: userInstance.instance_name,
      evolutionApiUrl: config.evolution_api_url,
      hasToken: !!config.evolution_api_token,
    });

    // Chamada simplificada para fetchAllGroups
    const response = await axios.get(
      `${config.evolution_api_url}/group/fetchAllGroups/${encodedInstance}?getParticipants=false`,
      {
        headers: {
          apikey: config.evolution_api_token,
        },
        // Removido timeout para permitir que a requisição demore o tempo necessário
      }
    );

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error("Resposta inválida da API - esperado array de grupos");
    }

    // Processamento simplificado dos grupos
    const groups = response.data.map((group) => ({
      id: group.id,
      name: group.subject || `Grupo ${group.id}`,
      isGroup: true,
      lastActivity: group.creation
        ? new Date(group.creation * 1000).toISOString()
        : null,
      size: group.size || 0,
      owner: group.owner || null,
      desc: group.desc || null,
    }));

    // Atualizar cache
    groupsCache = {
      items: groups,
      fetchedAt: Date.now(),
    };

    console.log(`Encontrados ${groups.length} grupos`);

    return res.json({
      success: true,
      chats: groups,
      currentPage: 1,
      hasMore: false,
      totalInPage: groups.length,
      totalFound: groups.length,
    });
  } catch (error) {
    console.error("Erro ao buscar grupos:", error.message);
    console.error("Detalhes do erro:", {
      status: error.response?.status,
      data: error.response?.data,
      code: error.code,
      message: error.message,
    });

    let errorMessage = "Erro ao buscar grupos";
    if (error.response?.status === 401) {
      errorMessage = "API Key inválida ou não autorizada";
    } else if (error.response?.status === 404) {
      errorMessage = "Instância não encontrada. Verifique o nome da instância.";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage =
        "Não foi possível conectar à Evolution API. Verifique a URL.";
    } else if (error.code === "ENOTFOUND") {
      errorMessage = "URL da Evolution API não encontrada. Verifique a URL.";
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    }

    res.status(400).json({
      success: false,
      error: errorMessage,
      details: {
        code: error.code,
        status: error.response?.status,
        message: error.message,
      },
    });
  }
});

// POST - Alterar senha do usuário logado
app.post("/api/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;

    if (!newPassword) {
      return res.status(400).json({ error: "Nova senha é obrigatória" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "Nova senha deve ter pelo menos 6 caracteres" });
    }

    // Verificar se o usuário precisa alterar a senha
    const forcePasswordChange = await db.checkForcePasswordChange(userId);

    if (!forcePasswordChange) {
      // Se não precisa forçar alteração, verificar senha atual
      if (!currentPassword) {
        return res.status(400).json({ error: "Senha atual é obrigatória" });
      }

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
