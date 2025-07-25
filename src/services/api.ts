import axios from "axios";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para adicionar token de autenticação da Evolution API
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("evolution_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  status: "pending" | "sent" | "cancelled";
  createdAt: string;
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
  getInfo: (apiUrl: string) => axios.get(`${apiUrl}/`),

  // Obter informações da instância - usando o ID da instância
  getInstanceInfo: (apiUrl: string, instanceId: string, token: string) =>
    axios.get(`${apiUrl}/instance/info/${instanceId}`, {
      headers: createAuthHeaders(token),
    }),

  // Obter todas as instâncias
  getAllInstances: (apiUrl: string, token: string) =>
    axios.get(`${apiUrl}/instance/fetchInstances`, {
      headers: createAuthHeaders(token),
    }),

  // Criar nova instância
  createInstance: (apiUrl: string, instanceName: string, token: string) =>
    axios.post(
      `${apiUrl}/instance/create/${instanceName}`,
      {},
      {
        headers: createAuthHeaders(token),
      }
    ),

  // Conectar instância
  connectInstance: (apiUrl: string, instanceName: string, token: string) =>
    axios.post(
      `${apiUrl}/instance/connect/${instanceName}`,
      {},
      {
        headers: createAuthHeaders(token),
      }
    ),

  // Desconectar instância
  disconnectInstance: (apiUrl: string, instanceName: string, token: string) =>
    axios.delete(`${apiUrl}/instance/logout/${instanceName}`, {
      headers: createAuthHeaders(token),
    }),

  // Deletar instância
  deleteInstance: (apiUrl: string, instanceName: string, token: string) =>
    axios.delete(`${apiUrl}/instance/delete/${instanceName}`, {
      headers: createAuthHeaders(token),
    }),

  // Obter contatos (usando findChats)
  getContacts: (apiUrl: string, instanceName: string, token: string) =>
    axios.post(
      `${apiUrl}/chat/findChats/${instanceName}`,
      {},
      { headers: createAuthHeaders(token) }
    ),

  // Enviar mensagem de texto
  sendTextMessage: (
    apiUrl: string,
    instanceName: string,
    token: string,
    data: {
      number: string;
      text: string;
      delay?: number;
      linkPreview?: boolean;
      mentionsEveryOne?: boolean;
    }
  ) => {
    // Formatar o número do telefone corretamente
    const formattedNumber = data.number.replace(/\D/g, ""); // Remove caracteres não numéricos

    const requestData = {
      number: formattedNumber,
      text: data.text,
      delay: data.delay ?? 0,
      linkPreview: data.linkPreview ?? false,
      mentionsEveryOne: data.mentionsEveryOne ?? false,
    };

    console.log("Dados da requisição:", requestData);

    return axios.post(
      `${apiUrl}/message/sendText/${instanceName}`,
      requestData,
      {
        headers: createAuthHeaders(token),
      }
    );
  },

  // Enviar mensagem de imagem
  sendImageMessage: (
    apiUrl: string,
    instanceName: string,
    token: string,
    data: {
      number: string;
      image: string;
      caption?: string;
    }
  ) =>
    axios.post(`${apiUrl}/chat/sendImage/${instanceName}`, data, {
      headers: createAuthHeaders(token),
    }),

  // Enviar mensagem de documento
  sendDocumentMessage: (
    apiUrl: string,
    instanceName: string,
    token: string,
    data: {
      number: string;
      document: string;
      caption?: string;
    }
  ) =>
    axios.post(`${apiUrl}/chat/sendDocument/${instanceName}`, data, {
      headers: createAuthHeaders(token),
    }),

  // Verificar status da instância
  getInstanceStatus: (apiUrl: string, instanceName: string, token: string) =>
    axios.get(`${apiUrl}/instance/info/${instanceName}`, {
      headers: createAuthHeaders(token),
    }),

  // Obter QR Code para conexão
  getQRCode: (apiUrl: string, instanceName: string, token: string) =>
    axios.post(
      `${apiUrl}/instance/connect/${instanceName}`,
      {},
      {
        headers: createAuthHeaders(token),
      }
    ),

  // Obter webhook
  getWebhook: (apiUrl: string, instanceName: string, token: string) =>
    axios.get(`${apiUrl}/webhook/find/${instanceName}`, {
      headers: createAuthHeaders(token),
    }),

  // Configurar webhook
  setWebhook: (
    apiUrl: string,
    instanceName: string,
    token: string,
    webhookUrl: string
  ) =>
    axios.post(
      `${apiUrl}/webhook/set/${instanceName}`,
      { url: webhookUrl },
      {
        headers: createAuthHeaders(token),
      }
    ),

  // Marcar mensagem como lida
  markMessageAsRead: (
    apiUrl: string,
    instanceName: string,
    token: string,
    messageId: string
  ) =>
    axios.post(
      `${apiUrl}/chat/markMessageAsRead/${instanceName}`,
      { messageId },
      {
        headers: createAuthHeaders(token),
      }
    ),
};

// Serviços de mensagens agendadas via backend
export const scheduledAPI = {
  getScheduledMessages: async (): Promise<ScheduledMessage[]> => {
    const res = await api.get("/api/schedules");
    // Adaptar para o formato esperado pelo frontend
    return (res.data || []).map((msg: any) => ({
      id: msg.id,
      contact: {
        id: msg.number,
        name: msg.number,
        number: msg.number,
      },
      message: msg.message,
      scheduledAt: msg.scheduledAt,
      status: msg.status,
      createdAt: msg.createdAt || msg.scheduledAt,
    }));
  },
  addScheduledMessage: async (message: {
    contactNumber: string;
    message: string;
    scheduledAt: string;
  }) => {
    const config = localAPI.getEvolutionConfig();
    const res = await api.post("/api/schedules", {
      number: message.contactNumber,
      message: message.message,
      scheduledAt: message.scheduledAt,
      apiUrl: config.apiUrl,
      instance: config.instanceName,
      token: config.token,
    });
    return res.data;
  },
  cancelScheduledMessage: async (id: string) => {
    await api.delete(`/api/schedules/${id}`);
  },
};

// Serviços locais (localStorage)
let messageProcessorStarted = false;
let messageProcessorInterval: ReturnType<typeof setInterval> | null = null;

export const localAPI = {
  // Configuração da Evolution API
  getEvolutionConfig: (): EvolutionConfig => {
    const config = localStorage.getItem("evolution_config");
    return config
      ? JSON.parse(config)
      : {
          apiUrl: "",
          instanceName: "",
          token: "",
          isConnected: false,
        };
  },

  setEvolutionConfig: (config: EvolutionConfig) => {
    localStorage.setItem("evolution_config", JSON.stringify(config));
  },

  // Contatos
  getContacts: async (): Promise<Contact[]> => {
    try {
      const config = localAPI.getEvolutionConfig();
      if (!config.apiUrl || !config.instanceName || !config.token) {
        throw new Error("Configuração da Evolution API não encontrada");
      }

      const response = await evolutionAPI.getContacts(
        config.apiUrl,
        config.instanceName,
        config.token
      );

      return response.data || [];
    } catch (error) {
      console.error("Erro ao obter contatos:", error);
      return [];
    }
  },

  // Função para processar mensagens agendadas
  processScheduledMessages: async () => {
    try {
      const messages = await scheduledAPI.getScheduledMessages();
      const now = new Date();
      const nowSP = new Date(
        now.toLocaleString("en-US", {
          timeZone: "America/Sao_Paulo",
        })
      );

      console.log("Processando mensagens agendadas...");
      console.log(
        "Horário atual (SP):",
        nowSP.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      );

      for (const message of messages) {
        if (message.status !== "pending") continue;

        const scheduledAt = new Date(message.scheduledAt);
        const scheduledSP = new Date(
          scheduledAt.toLocaleString("en-US", {
            timeZone: "America/Sao_Paulo",
          })
        );

        console.log(`Verificando mensagem ${message.id}:`, {
          scheduled: scheduledSP.toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
          status: message.status,
        });

        // Se a mensagem deve ser enviada agora
        if (scheduledSP <= nowSP) {
          console.log(`Enviando mensagem ${message.id}...`);

          try {
            const success = await localAPI.sendMessage(
              message.contact.number,
              message.message
            );

            if (success) {
              await scheduledAPI.cancelScheduledMessage(message.id);
              console.log(`Mensagem ${message.id} enviada com sucesso!`);
            } else {
              console.error(`Falha ao enviar mensagem ${message.id}`);
            }
          } catch (error) {
            console.error(`Erro ao enviar mensagem ${message.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao processar mensagens agendadas:", error);
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
        config.token,
        {
          number: phoneNumber,
          text: message,
          delay: 1000, // 1 segundo de delay em ms
          linkPreview: false,
          mentionsEveryOne: false,
        }
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

  // Função para iniciar o processamento automático
  startMessageProcessor: () => {
    if (messageProcessorStarted) return;
    messageProcessorStarted = true;
    // Processar imediatamente
    localAPI.processScheduledMessages();
    // Processar a cada minuto
    messageProcessorInterval = setInterval(() => {
      localAPI.processScheduledMessages();
    }, 60000); // 60 segundos
    console.log("🔄 Processador de mensagens agendadas iniciado");
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

export default api;
