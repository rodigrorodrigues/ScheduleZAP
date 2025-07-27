import axios from "axios";

// Obter a URL da API do ambiente
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8999";

// Criar instância do axios
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("❌ Erro na requisição:", {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export interface Contact {
  id: string;
  name: string;
  number: string;
}

export interface ScheduledMessage {
  id: string;
  contact: Contact;
  message: string;
  scheduledAt: string;
  status: "pending" | "sent" | "cancelled" | "failed";
  createdAt: string;
  processedAt: string | null;
  error: string | null;
  apiUrl: string;
  instance: string;
  token: string;
  retries: number;
}

export interface ScheduleMessageRequest {
  contactId: string;
  message: string;
  scheduledAt: string;
}

export interface EvolutionConfig {
  apiUrl: string;
  instanceName: string;
  token: string;
  isConnected: boolean;
}

export interface InstanceInfo {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid?: string;
  profileName?: string;
  qrcode?: string;
  webhook?: string;
  webhookByEvents?: boolean;
  events?: string[];
  sessionId?: string;
  token?: string;
}

// Função para limpar configurações corrompidas
const clearCorruptedConfig = () => {
  console.log("🧹 Limpando configurações corrompidas...");
  localStorage.removeItem("evolution_config");
  localStorage.removeItem("evolution_token");
};

// Função para limpar e formatar a URL da API
function cleanApiUrl(url: string): string {
  // Remove espaços no início e fim
  let cleanUrl = url.trim();

  // Garante que a URL começa com http:// ou https://
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    cleanUrl = "https://" + cleanUrl;
  }

  // Remove barras duplas extras (exceto após http: ou https:)
  cleanUrl = cleanUrl.replace(/([^:])\/+/g, "$1/");

  // Garante que a URL termina com uma única barra
  if (!cleanUrl.endsWith("/")) {
    cleanUrl += "/";
  }

  return cleanUrl;
}

// Função para criar headers de autenticação - usando apenas apikey que funciona
const createAuthHeaders = (token: string) => {
  return {
    apikey: token, // Formato que funciona com a Evolution API
    "Content-Type": "application/json",
  };
};

// Serviços da Evolution API v2 (conforme documentação oficial)
export const evolutionAPI = {
  // Obter informações da API
  getInfo: (apiUrl: string) => axios.get(`${cleanApiUrl(apiUrl)}`),

  // Obter informações da instância - usando o ID da instância
  getInstanceInfo: (apiUrl: string, instanceId: string, token: string) =>
    axios.get(`${cleanApiUrl(apiUrl)}instance/info/${instanceId}`, {
      headers: createAuthHeaders(token),
    }),

  // Obter todas as instâncias
  getAllInstances: (apiUrl: string, token: string) =>
    axios.get(`${cleanApiUrl(apiUrl)}instance/fetchInstances`, {
      headers: createAuthHeaders(token),
    }),

  // Criar nova instância
  createInstance: (apiUrl: string, instanceName: string, token: string) =>
    axios.post(
      `${cleanApiUrl(apiUrl)}instance/create/${instanceName}`,
      {},
      {
        headers: createAuthHeaders(token),
      }
    ),

  // Conectar instância
  connectInstance: (apiUrl: string, instanceName: string, token: string) =>
    axios.post(
      `${cleanApiUrl(apiUrl)}instance/connect/${instanceName}`,
      {},
      {
        headers: createAuthHeaders(token),
      }
    ),

  // Desconectar instância
  disconnectInstance: (apiUrl: string, instanceName: string, token: string) =>
    axios.delete(`${cleanApiUrl(apiUrl)}instance/logout/${instanceName}`, {
      headers: createAuthHeaders(token),
    }),

  // Obter QR Code
  getQRCode: (apiUrl: string, instanceName: string, token: string) =>
    axios.get(`${cleanApiUrl(apiUrl)}instance/connect/${instanceName}`, {
      headers: createAuthHeaders(token),
    }),

  // Enviar mensagem de texto
  sendTextMessage: (
    apiUrl: string,
    instanceName: string,
    number: string,
    message: string,
    token: string
  ) =>
    axios.post(
      `${cleanApiUrl(apiUrl)}message/sendText/${instanceName}`,
      {
        number,
        text: message,
        delay: 1000,
      },
      {
        headers: createAuthHeaders(token),
      }
    ),

  // Obter contatos
  getContacts: (apiUrl: string, instanceName: string, token: string) =>
    axios.post(
      `${cleanApiUrl(apiUrl)}chat/findChats/${instanceName}`,
      {},
      {
        headers: createAuthHeaders(token),
      }
    ),
};

// Interfaces para teste de conectividade
export interface EvolutionTestBase {
  success: boolean;
}

export interface EvolutionTestResult extends EvolutionTestBase {
  success: true;
  baseUrl: boolean;
  auth: boolean;
  instance: boolean;
  instanceInfo: any;
  messageSent?: boolean;
}

export interface EvolutionTestError extends EvolutionTestBase {
  success: false;
  error: string;
  details: {
    status: number | null;
    data: any;
    code: string | null;
  };
}

export type EvolutionTestResponse = EvolutionTestResult | EvolutionTestError;

// Função para testar conectividade com Evolution API
async function testEvolutionConnection(
  apiUrl: string,
  instance: string,
  token: string
): Promise<EvolutionTestResponse> {
  console.log("🔍 Testando conectividade com Evolution API:");
  console.log(`   URL: ${apiUrl}`);
  console.log(`   Instância: ${instance}`);
  try {
    // Teste 1: Verificar se a URL base responde
    console.log("👉 Teste 1: Verificando URL base...");
    const baseResponse = await axios.get(apiUrl, {
      timeout: 10000,
      validateStatus: null,
    });
    console.log(`   Status: ${baseResponse.status}`);
    console.log(`   Resposta:`, baseResponse.data);
    if (baseResponse.status !== 200) {
      throw new Error(`URL base retornou status ${baseResponse.status}`);
    }

    // Teste 2: Verificar autenticação e listar instâncias
    console.log("👉 Teste 2: Verificando autenticação...");
    const authResponse = await axios.get(`${apiUrl}instance/fetchInstances`, {
      headers: { apikey: token },
      timeout: 10000,
      validateStatus: null,
    });
    console.log(`   Status: ${authResponse.status}`);
    console.log(`   Resposta:`, authResponse.data);
    if (authResponse.status === 401) {
      throw new Error("Token de autenticação inválido");
    }
    if (authResponse.status !== 200) {
      throw new Error(`Erro de autenticação: status ${authResponse.status}`);
    }

    // Verificar se a instância existe na lista retornada
    const instances = Array.isArray(authResponse.data) ? authResponse.data : [];
    const instanceData = instances.find((inst: any) => inst.name === instance);

    if (!instanceData) {
      throw new Error(
        `Instância '${instance}' não encontrada na lista de instâncias disponíveis`
      );
    }

    // Verificar se a instância está conectada
    if (instanceData.connectionStatus !== "open") {
      throw new Error(
        `Instância '${instance}' está desconectada (status: ${instanceData.connectionStatus})`
      );
    }

    // Em vez de tentar o endpoint info, vamos usar os dados que já temos
    return {
      success: true,
      baseUrl: true,
      auth: true,
      instance: true,
      instanceInfo: instanceData,
    };
  } catch (error: any) {
    console.error("❌ Erro no teste de conectividade:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code,
    });
    if (error.code === "ECONNREFUSED") {
      throw new Error("Não foi possível conectar à API (conexão recusada)");
    }
    if (error.code === "ECONNABORTED") {
      throw new Error("Tempo de conexão esgotado");
    }
    if (error.code === "ERR_BAD_REQUEST") {
      throw new Error("URL da API inválida");
    }
    if (error.response?.status === 401) {
      throw new Error("Token de autenticação inválido");
    }
    if (
      error.response?.status === 404 &&
      !error.message.includes("não encontrada")
    ) {
      throw new Error("Endpoint não encontrado - verifique a URL da API");
    }
    throw new Error(error.message || "Erro desconhecido ao testar conexão");
  }
}

// Função para enviar mensagem via Evolution API
async function sendMessage(
  number: string,
  message: string,
  apiUrl: string,
  instance: string,
  token: string
): Promise<boolean> {
  console.log("📤 Enviando mensagem via Evolution API:", {
    apiUrl,
    instance,
    number,
    message: message.substring(0, 20) + "...", // Log parcial da mensagem
  });

  try {
    // Primeiro verificar se a instância está conectada
    const testResult = await testEvolutionConnection(apiUrl, instance, token);
    if (!testResult.success) {
      console.error("❌ Instância não está pronta para enviar mensagens");
      return false;
    }

    // Enviar a mensagem
    const response = await axios.post(
      `${cleanApiUrl(apiUrl)}message/sendText/${encodeURIComponent(instance)}`,
      {
        number: number.replace(/\D/g, ""), // Remove não-dígitos
        text: message,
        delay: 1000,
      },
      {
        headers: { apikey: token },
        timeout: 10000,
      }
    );

    console.log("✅ Mensagem enviada com sucesso:", response.status);
    return true;
  } catch (error: any) {
    console.error("❌ Erro ao enviar mensagem:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return false;
  }
}

// Função para buscar agendamentos
export const scheduledAPI = {
  getScheduledMessages: async (): Promise<ScheduledMessage[]> => {
    try {
      const res = await api.get("/schedules");
      console.log("📋 Agendamentos recebidos:", res.data);
      const data = Array.isArray(res.data) ? res.data : [];
      return data.map((msg: any) => ({
        id: msg.id,
        contact: { id: msg.number, name: msg.number, number: msg.number },
        message: msg.message,
        scheduledAt: msg.scheduledAt,
        status: msg.status,
        createdAt: msg.createdAt || msg.scheduledAt,
        processedAt: msg.processedAt,
        error: msg.error,
        apiUrl: msg.apiUrl,
        instance: msg.instance,
        token: msg.token,
        retries: msg.retries || 0,
      }));
    } catch (error: any) {
      console.error("❌ Erro ao buscar agendamentos:", error);
      return [];
    }
  },

  addScheduledMessage: async (message: {
    contactNumber: string;
    message: string;
    scheduledAt: string;
  }) => {
    try {
      const config = localAPI.getEvolutionConfig();
      if (!config.apiUrl || !config.instanceName || !config.token) {
        throw new Error("Configure a Evolution API primeiro");
      }

      const res = await api.post("/schedules", {
        number: message.contactNumber.replace(/\D/g, ""),
        message: message.message.trim(),
        scheduledAt: message.scheduledAt,
        apiUrl: cleanApiUrl(config.apiUrl),
        instance: config.instanceName,
        token: config.token,
      });

      console.log("✅ Mensagem agendada:", res.data);
      return res.data;
    } catch (error: any) {
      console.error("❌ Erro ao agendar mensagem:", error);
      throw new Error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao agendar mensagem"
      );
    }
  },

  cancelScheduledMessage: async (id: string) => {
    if (!id) {
      throw new Error("ID do agendamento é obrigatório");
    }
    try {
      await api.delete(`/schedules/${id}`);
    } catch (error: any) {
      console.error("❌ Erro ao cancelar agendamento:", error);
      throw new Error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Erro ao cancelar agendamento"
      );
    }
  },

  testEvolutionAPI: async (config: {
    apiUrl: string;
    instance: string;
    token: string;
    number?: string;
    message?: string;
  }): Promise<EvolutionTestResponse> => {
    try {
      const cleanedUrl = cleanApiUrl(config.apiUrl);
      const testResult = await testEvolutionConnection(
        cleanedUrl,
        config.instance,
        config.token
      );

      if (testResult.success && config.number && config.message) {
        console.log("👉 Teste 4: Simulando envio de mensagem...");
        const messageResponse = await axios.post(
          `${cleanedUrl}message/sendText/${encodeURIComponent(
            config.instance
          )}`,
          { number: config.number, text: config.message, delay: 1000 },
          {
            headers: { apikey: config.token },
            timeout: 10000,
            validateStatus: null,
          }
        );
        console.log(`   Status: ${messageResponse.status}`);
        console.log(`   Resposta:`, messageResponse.data);
        if (messageResponse.status !== 200 && messageResponse.status !== 201) {
          throw new Error(
            `Erro ao simular envio: status ${messageResponse.status}`
          );
        }
        testResult.messageSent = true;
      }

      return testResult;
    } catch (error: any) {
      console.error("❌ Erro ao testar Evolution API:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      });
      return {
        success: false,
        error: error.message,
        details: {
          status: error.response?.status,
          data: error.response?.data,
          code: error.code,
        },
      };
    }
  },
};

// Serviços locais (localStorage)
export const localAPI = {
  // Configuração da Evolution API
  getEvolutionConfig: (): EvolutionConfig => {
    try {
      const config = localStorage.getItem("evolution_config");
      if (!config) {
        return {
          apiUrl: "",
          instanceName: "",
          token: "",
          isConnected: false,
        };
      }

      const parsedConfig = JSON.parse(config);

      // Limpar URL malformada se existir
      if (parsedConfig.apiUrl) {
        parsedConfig.apiUrl = cleanApiUrl(parsedConfig.apiUrl);
      }

      return parsedConfig;
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
      clearCorruptedConfig();
      return {
        apiUrl: "",
        instanceName: "",
        token: "",
        isConnected: false,
      };
    }
  },

  setEvolutionConfig: async (config: EvolutionConfig) => {
    try {
      // Testar conectividade antes de salvar
      if (config.apiUrl && config.instanceName && config.token) {
        try {
          const testResult = await scheduledAPI.testEvolutionAPI({
            apiUrl: config.apiUrl,
            instance: config.instanceName,
            token: config.token,
          });

          config.isConnected = testResult.success;

          if (!testResult.success && "error" in testResult) {
            console.warn(
              "⚠️ Aviso: Falha no teste de conectividade:",
              testResult.error
            );
          }
        } catch (error: any) {
          // Não impedir o salvamento se o teste falhar
          console.warn(
            "⚠️ Aviso: Falha no teste de conectividade:",
            error.message
          );
          config.isConnected = false;
        }
      } else {
        config.isConnected = false;
      }

      // Salvar configuração mesmo se o teste falhar
      localStorage.setItem("evolution_config", JSON.stringify(config));
      console.log("✅ Configuração salva:", config);

      return config;
    } catch (error: any) {
      console.error("❌ Erro ao salvar configuração:", error);
      throw new Error("Erro ao salvar configuração: " + error.message);
    }
  },

  // Função para conectar instância
  connectInstance: async (
    apiUrl: string,
    instanceName: string,
    token: string
  ): Promise<boolean> => {
    try {
      const response = await evolutionAPI.connectInstance(
        apiUrl,
        instanceName,
        token
      );
      console.log("Connect Instance Response:", response.data);
      return true;
    } catch (error: any) {
      console.error("Erro ao conectar instância:", error);
      return false;
    }
  },

  // Função para enviar mensagem real via Evolution API
  sendMessage: async (
    contactNumber: string,
    message: string
  ): Promise<boolean> => {
    try {
      const config = localAPI.getEvolutionConfig();
      if (!config.apiUrl || !config.instanceName || !config.token) {
        throw new Error("Configuração da Evolution API não encontrada");
      }

      console.log("Enviando mensagem:", {
        apiUrl: config.apiUrl,
        instanceName: config.instanceName,
        contactNumber,
        message: message.substring(0, 50) + "...",
      });

      // Verificar se a instância está conectada antes de enviar
      try {
        const isConnected = await localAPI.testConnection(
          config.apiUrl,
          config.instanceName,
          config.token
        );

        if (!isConnected) {
          console.log("Instância não está conectada. Tentando conectar...");
          const connected = await localAPI.connectInstance(
            config.apiUrl,
            config.instanceName,
            config.token
          );

          if (!connected) {
            console.error(
              "Não foi possível conectar a instância. Conecte primeiro via QR Code."
            );
            return false;
          }

          // Aguardar um pouco para a conexão ser estabelecida
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (connectionError) {
        console.error("Erro ao verificar/conectar instância:", connectionError);
        return false;
      }

      // Se contactNumber contém apenas dígitos, use direto
      let phoneNumber = contactNumber;
      if (!/^[0-9]+$/.test(contactNumber)) {
        // Só busca na API se NÃO for um número
        console.log("ContactNumber parece ser um ID, buscando número real...");
        try {
          const contacts = await evolutionAPI.getContacts(
            config.apiUrl,
            config.instanceName,
            config.token
          );

          const contact = contacts.data.find(
            (c: any) => c.id === contactNumber
          );
          if (contact && contact.number) {
            phoneNumber = contact.number;
            console.log("Número encontrado:", phoneNumber);
          } else {
            console.error(
              "Contato não encontrado ou sem número:",
              contactNumber
            );
            return false;
          }
        } catch (contactError) {
          console.error("Erro ao buscar contato:", contactError);
          return false;
        }
      }

      const response = await evolutionAPI.sendTextMessage(
        config.apiUrl,
        config.instanceName,
        phoneNumber,
        message,
        config.token
      );

      console.log("Resposta do envio:", response.data);
      return true;
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
        console.error("Headers:", error.response.headers);

        // Se for erro 400, mostrar detalhes específicos
        if (error.response.status === 400) {
          console.error("Erro 400 - Bad Request. Possíveis causas:");
          console.error("- Número de telefone em formato incorreto");
          console.error("- Instância não conectada");
          console.error("- Token inválido");
          console.error("- Dados da requisição inválidos");
        }
      }
      return false;
    }
  },

  // Função para testar se a API está funcionando
  testAPI: async (apiUrl: string): Promise<boolean> => {
    try {
      const response = await evolutionAPI.getInfo(apiUrl);
      console.log("API Test Response:", response.data);
      return response.status === 200;
    } catch (error) {
      console.error("Erro ao testar API:", error);
      return false;
    }
  },

  // Função para testar conexão com instância
  testConnection: async (
    apiUrl: string,
    instanceName: string,
    token: string
  ): Promise<boolean> => {
    try {
      // Primeiro, vamos testar se a API está funcionando
      const apiInfo = await evolutionAPI.getInfo(apiUrl);
      console.log("API Info:", apiInfo.data);

      // Obter todas as instâncias para encontrar a instância pelo nome
      const instancesResponse = await evolutionAPI.getAllInstances(
        apiUrl,
        token
      );
      const instances = instancesResponse.data || [];

      // Encontrar a instância pelo nome
      const instance = instances.find(
        (inst: InstanceInfo) => inst.name === instanceName
      );

      if (!instance) {
        throw new Error(
          `Instância "${instanceName}" não encontrada. Verifique o nome da instância ou crie uma nova.`
        );
      }

      console.log("Instance Info:", instance);

      // Verificar se a instância está conectada
      return instance.connectionStatus === "open";
    } catch (error: any) {
      console.error("Erro ao testar conexão:", error);

      // Se for 404, a instância não existe
      if (error.response?.status === 404) {
        throw new Error(
          `Instância "${instanceName}" não encontrada. Verifique o nome da instância ou crie uma nova.`
        );
      }

      // Se for 401, problema de autenticação
      if (error.response?.status === 401) {
        throw new Error(
          "Token de autenticação inválido. Verifique o token configurado."
        );
      }

      // Se for 403, problema de permissão
      if (error.response?.status === 403) {
        throw new Error(
          "Acesso negado. Verifique se o token tem as permissões necessárias."
        );
      }

      return false;
    }
  },

  // Função para listar instâncias disponíveis
  getAvailableInstances: async (
    apiUrl: string,
    token: string
  ): Promise<InstanceInfo[]> => {
    try {
      // Primeiro testar se a API está funcionando
      const apiInfo = await evolutionAPI.getInfo(apiUrl);
      console.log("API Info:", apiInfo.data);

      const response = await evolutionAPI.getAllInstances(apiUrl, token);
      console.log("Instances Response:", response.data);
      return response.data || [];
    } catch (error: any) {
      console.error("Erro ao listar instâncias:", error);

      if (error.response?.status === 401) {
        throw new Error(
          "Token de autenticação inválido. Verifique o token configurado."
        );
      }

      if (error.response?.status === 403) {
        throw new Error(
          "Acesso negado. Verifique se o token tem as permissões necessárias."
        );
      }

      throw new Error("Não foi possível listar as instâncias disponíveis.");
    }
  },

  // Função para criar nova instância
  createNewInstance: async (
    apiUrl: string,
    instanceName: string,
    token: string
  ): Promise<InstanceInfo> => {
    try {
      const response = await evolutionAPI.createInstance(
        apiUrl,
        instanceName,
        token
      );
      console.log("Create Instance Response:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("Erro ao criar instância:", error);

      if (error.response?.status === 401) {
        throw new Error(
          "Token de autenticação inválido. Verifique o token configurado."
        );
      }

      if (error.response?.status === 409) {
        throw new Error(`Instância "${instanceName}" já existe.`);
      }

      throw new Error(`Não foi possível criar a instância "${instanceName}".`);
    }
  },

  // Função para obter QR Code
  getQRCode: async (
    apiUrl: string,
    instanceName: string,
    token: string
  ): Promise<string | null> => {
    try {
      const response = await evolutionAPI.getQRCode(
        apiUrl,
        instanceName,
        token
      );
      console.log("QR Code Response:", response.data);
      return response.data.qrcode || null;
    } catch (error) {
      console.error("Erro ao obter QR Code:", error);
      return null;
    }
  },
};

// Verificação automática de configurações corrompidas
const checkAndFixConfig = () => {
  try {
    const config = localStorage.getItem("evolution_config");
    if (config) {
      const parsed = JSON.parse(config);
      if (parsed.apiUrl && parsed.apiUrl.includes("//")) {
        console.log("🔧 Detectada URL malformada, limpando configurações...");
        clearCorruptedConfig();
      }
    }
  } catch (error) {
    console.log("🔧 Configuração corrompida detectada, limpando...");
    clearCorruptedConfig();
  }
};

// Executar verificação ao carregar o módulo
checkAndFixConfig();

export default api;
