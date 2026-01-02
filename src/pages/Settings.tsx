import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Settings as SettingsIcon,
  Wifi,
  Key,
  Plus,
  List,
  TestTube,
  Bug,
  Trash2,
} from "lucide-react";
import {
  localAPI,
  EvolutionConfig,
  InstanceInfo,
  scheduledAPI,
  EvolutionTestResponse,
  EvolutionTestError,
} from "../services/api";
import toast from "react-hot-toast";
import axios from "axios";
import { Spinner } from "../components/Spinner";
import {
  getConnectionStatusIcon,
  getConnectionStatusText,
  getConnectionStatusColor,
  getInstanceStatusColor,
} from "../utils/status";

// Type guard para verificar se é um erro
function isEvolutionError(
  result: EvolutionTestResponse
): result is EvolutionTestError {
  return !result.success;
}

interface SettingsFormData {
  apiUrl: string;
  instanceName: string;
  token: string;
}

export default function Settings() {
  const [config, setConfig] = useState<EvolutionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingAPI, setIsTestingAPI] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "testing" | null
  >(null);
  const [availableInstances, setAvailableInstances] = useState<InstanceInfo[]>(
    []
  );
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [showInstances, setShowInstances] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<SettingsFormData>();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const savedConfig = localAPI.getEvolutionConfig();
    setConfig(savedConfig);
    setValue("apiUrl", savedConfig.apiUrl);
    setValue("instanceName", savedConfig.instanceName);
    setValue("token", savedConfig.token);
    setConnectionStatus(savedConfig.isConnected ? "connected" : "disconnected");
  };

  // Validar URL da Evolution API
  const validateApiUrl = (url: string) => {
    if (!url) return "URL da API é obrigatória";
    if (!/^https?:\/\/.+/.test(url))
      return "URL deve começar com http:// ou https://";
    return true;
  };

  // Validar nome da instância
  const validateInstanceName = (name: string) => {
    if (!name) return "Nome da instância é obrigatório";
    if (!/^[a-zA-Z0-9\s-_]+$/.test(name))
      return "Nome deve conter apenas letras, números, espaços, - e _";
    if (name.trim() !== name)
      return "Nome não pode começar ou terminar com espaços";
    return true;
  };

  // Validar token
  const validateToken = (token: string) => {
    if (!token) return "Token é obrigatório";
    if (token.length < 32) return "Token muito curto";
    return true;
  };

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);

    try {
      // Validar URL
      const urlValidation = validateApiUrl(data.apiUrl);
      if (urlValidation !== true) {
        toast.error(urlValidation);
        return;
      }

      // Validar instância
      const instanceValidation = validateInstanceName(data.instanceName);
      if (instanceValidation !== true) {
        toast.error(instanceValidation);
        return;
      }

      // Validar token
      const tokenValidation = validateToken(data.token);
      if (tokenValidation !== true) {
        toast.error(tokenValidation);
        return;
      }

      // Limpar e formatar dados
      const newConfig: EvolutionConfig = {
        apiUrl: data.apiUrl.trim(),
        instanceName: data.instanceName.trim(),
        token: data.token.trim(),
        isConnected: false,
      };

      // Salvar configuração
      const savedConfig = await localAPI.setEvolutionConfig(newConfig);
      setConfig(savedConfig);

      // Se a configuração foi salva com sucesso
      if (savedConfig.isConnected) {
        toast.success("Configuração salva e testada com sucesso!");
        setConnectionStatus("connected");
      } else {
        // Se o teste falhou mas a configuração foi salva
        toast.success("Configuração salva!");
        toast("⚠️ Não foi possível conectar à Evolution API", {
          icon: "⚠️",
          duration: 4000,
        });
        setConnectionStatus("disconnected");
      }
    } catch (error: any) {
      console.error("❌ Erro ao salvar configuração:", error);
      toast.error(error.message || "Erro ao salvar configuração");
      setConnectionStatus("disconnected");
    } finally {
      setIsLoading(false);
    }
  };

  const testAPI = async () => {
    if (!config?.apiUrl) {
      toast.error("Configure a URL da API primeiro");
      return;
    }

    setIsTestingAPI(true);

    try {
      const testResult = await scheduledAPI.testEvolutionAPI({
        apiUrl: config.apiUrl,
        instance: config.instanceName || "test",
        token: config.token || "test",
      });

      if (testResult.success) {
        toast.success("API está funcionando!");
        setConnectionStatus("connected");
      } else {
        throw new Error(testResult.error || "API não está respondendo");
      }
    } catch (error: any) {
      console.error("❌ Erro ao testar API:", error);
      toast.error(error.message || "API não está respondendo");
      setConnectionStatus("disconnected");
    } finally {
      setIsTestingAPI(false);
    }
  };

  const debugAuthentication = async () => {
    if (!config?.apiUrl || !config?.token) {
      toast.error("Configure a URL da API e o token primeiro");
      return;
    }

    setIsDebugging(true);
    console.log("🔍 Iniciando debug de autenticação...");
    console.log("URL:", config.apiUrl);
    console.log("Token:", config.token);

    try {
      // Teste 1: Bearer Token
      try {
        const response1 = await axios.get(
          `${config.apiUrl}/instance/fetchInstances`,
          {
            headers: {
              Authorization: `Bearer ${config.token}`,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("Teste 1 - Bearer Token:", response1.status);
      } catch (error: any) {
        console.log(
          "Teste 1 - Bearer Token:",
          error.response?.status || "Erro"
        );
      }

      // Teste 2: apikey Header
      try {
        const response2 = await axios.get(
          `${config.apiUrl}/instance/fetchInstances`,
          {
            headers: {
              apikey: config.token,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("Teste 2 - apikey Header:", response2.status);
      } catch (error: any) {
        console.log(
          "Teste 2 - apikey Header:",
          error.response?.status || "Erro"
        );
      }

      // Teste 3: x-api-key Header
      try {
        const response3 = await axios.get(
          `${config.apiUrl}/instance/fetchInstances`,
          {
            headers: {
              "x-api-key": config.token,
              "Content-Type": "application/json",
            },
          }
        );
        console.log("Teste 3 - x-api-key Header:", response3.status);
      } catch (error: any) {
        console.log(
          "Teste 3 - x-api-key Header:",
          error.response?.status || "Erro"
        );
      }

      // Teste 4: Query Parameter
      try {
        const response4 = await axios.get(
          `${config.apiUrl}/instance/fetchInstances?apikey=${config.token}`
        );
        console.log("Teste 4 - Query Parameter:", response4.status);
      } catch (error: any) {
        console.log(
          "Teste 4 - Query Parameter:",
          error.response?.status || "Erro"
        );
      }

      toast.success("Debug concluído! Verifique o console.");
    } catch (error) {
      toast.error("Erro durante o debug");
    } finally {
      setIsDebugging(false);
    }
  };

  const testSendMessage = async () => {
    if (!config?.apiUrl || !config?.instanceName || !config?.token) {
      toast.error("Configure a API, instância e token primeiro");
      return;
    }

    try {
      const success = await localAPI.sendMessage(
        "5519994466218",
        "Teste de mensagem do ScheduleZAP"
      );
      if (success) {
        toast.success("Mensagem de teste enviada com sucesso!");
      } else {
        toast.error("Falha ao enviar mensagem de teste");
      }
    } catch (error) {
      toast.error("Erro ao enviar mensagem de teste");
    }
  };

  const connectInstance = async () => {
    if (!config?.apiUrl || !config?.instanceName || !config?.token) {
      toast.error("Configure a API, instância e token primeiro");
      return;
    }

    try {
      const success = await localAPI.connectInstance(
        config.apiUrl,
        config.instanceName,
        config.token
      );
      if (success) {
        toast.success("Instância conectada com sucesso!");
      } else {
        toast.error("Falha ao conectar instância");
      }
    } catch (error) {
      toast.error("Erro ao conectar instância");
    }
  };

  const testConnection = async () => {
    if (!config?.apiUrl || !config?.instanceName || !config?.token) {
      toast.error("Configure todos os campos primeiro");
      return;
    }

    setIsTesting(true);

    try {
      const testResult = await scheduledAPI.testEvolutionAPI({
        apiUrl: config.apiUrl,
        instance: config.instanceName,
        token: config.token,
        number: "5519994466218",
        message: "Teste de conexão do ScheduleZAP",
      });

      if (isEvolutionError(testResult)) {
        throw new Error(testResult.error);
      }

      toast.success("Conexão testada com sucesso!");
      setConnectionStatus("connected");
    } catch (error: any) {
      console.error("❌ Erro ao testar conexão:", error);
      toast.error(error.message || "Falha no teste de conexão");
      setConnectionStatus("disconnected");
    } finally {
      setIsTesting(false);
    }
  };

  const loadAvailableInstances = async () => {
    if (!config?.apiUrl || !config?.token) {
      toast.error("Configure a URL da API e o token primeiro");
      return;
    }

    setIsLoadingInstances(true);
    setShowInstances(true);

    try {
      const instances = await localAPI.getAvailableInstances(
        config.apiUrl,
        config.token
      );
      setAvailableInstances(instances);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar instâncias");
    } finally {
      setIsLoadingInstances(false);
    }
  };

  const createNewInstance = async () => {
    if (!newInstanceName.trim() || !config?.apiUrl || !config?.token) {
      toast.error("Digite um nome para a instância e configure a API primeiro");
      return;
    }

    setIsCreatingInstance(true);

    try {
      await localAPI.createNewInstance(
        config.apiUrl,
        newInstanceName.trim(),
        config.token
      );
      toast.success(`Instância "${newInstanceName}" criada com sucesso!`);
      setNewInstanceName("");
      loadAvailableInstances(); // Recarregar lista
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar instância");
    } finally {
      setIsCreatingInstance(false);
    }
  };

  const selectInstance = (instanceName: string) => {
    setValue("instanceName", instanceName);
    if (config) {
      const updatedConfig = { ...config, instanceName };
      setConfig(updatedConfig);
      localAPI.setEvolutionConfig(updatedConfig);
    }
    toast.success(`Instância "${instanceName}" selecionada!`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
      </div>

      {/* Status da Conexão */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">
              Status da Conexão
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            {getConnectionStatusIcon(connectionStatus)}
            <span className={`text-sm font-medium ${getConnectionStatusColor(connectionStatus)}`}>
              {getConnectionStatusText(connectionStatus)}
            </span>
          </div>
        </div>
      </div>

      {/* Formulário de Configuração */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <div className="flex items-center space-x-3 mb-4">
            <Wifi className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">
              Configuração da Evolution API v2
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="apiUrl"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                URL da API
              </label>
              <div className="flex space-x-2">
                <input
                  id="apiUrl"
                  type="url"
                  {...register("apiUrl", {
                    required: "URL da API é obrigatória",
                    pattern: {
                      value: /^https?:\/\/.+/,
                      message: "URL deve começar com http:// ou https://",
                    },
                  })}
                  className="input-field flex-1"
                  placeholder="http://89.116.171.102:8080"
                />
                <button
                  type="button"
                  onClick={testAPI}
                  disabled={isTestingAPI || !config?.apiUrl}
                  className="btn-secondary px-4"
                >
                  {isTestingAPI ? (
                    <Spinner size="sm" color="secondary" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.apiUrl && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.apiUrl.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="instanceName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Nome da Instância
              </label>
              <div className="flex space-x-2">
                <input
                  id="instanceName"
                  type="text"
                  {...register("instanceName", {
                    required: "Nome da instância é obrigatório",
                  })}
                  className="input-field flex-1"
                  placeholder="Ex: Minha Instância"
                />
                <button
                  type="button"
                  onClick={loadAvailableInstances}
                  disabled={
                    isLoadingInstances || !config?.apiUrl || !config?.token
                  }
                  className="btn-secondary px-4"
                >
                  {isLoadingInstances ? (
                    <Spinner size="sm" color="secondary" />
                  ) : (
                    <List className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.instanceName && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.instanceName.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Token de Autenticação
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <input
                    id="token"
                    type="password"
                    {...register("token", {
                      required: "Token de autenticação é obrigatório",
                    })}
                    className="input-field pr-10"
                    placeholder="Seu token da Evolution API"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <Key className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={debugAuthentication}
                  disabled={isDebugging || !config?.apiUrl || !config?.token}
                  className="btn-secondary px-4"
                >
                  {isDebugging ? (
                    <Spinner size="sm" color="secondary" />
                  ) : (
                    <Bug className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.token && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.token.message}
                </p>
              )}
            </div>

            {/* Botão de teste de envio */}
            <div className="mt-4">
              <button
                type="button"
                onClick={connectInstance}
                disabled={
                  !config?.apiUrl || !config?.instanceName || !config?.token
                }
                className="btn-secondary w-full mb-2"
              >
                🔗 Conectar Instância
              </button>
              <button
                type="button"
                onClick={testSendMessage}
                disabled={
                  !config?.apiUrl || !config?.instanceName || !config?.token
                }
                className="btn-secondary w-full"
              >
                📤 Testar Envio de Mensagem
              </button>

              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("evolution_config");
                  localStorage.removeItem("evolution_token");
                  window.location.reload();
                }}
                className="btn-secondary w-full mt-2"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Configurações
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Instâncias Disponíveis */}
        {showInstances && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Instâncias Disponíveis
              </h3>
              <button
                type="button"
                onClick={() => setShowInstances(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {isLoadingInstances ? (
              <div className="text-center py-8">
                <Spinner size="md" color="primary" className="mx-auto" />
                <p className="mt-2 text-sm text-gray-500">
                  Carregando instâncias...
                </p>
              </div>
            ) : availableInstances.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhuma instância encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(availableInstances || []).map((instance) => (
                  <div
                    key={instance.name}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                    onClick={() => selectInstance(instance.name)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {instance.name}
                      </p>
                      <p
                        className={`text-sm ${getInstanceStatusColor(
                          instance.connectionStatus
                        )}`}
                      >
                        Status: {instance.connectionStatus}
                      </p>
                      {instance.profileName && (
                        <p className="text-xs text-gray-500">
                          Perfil: {instance.profileName}
                        </p>
                      )}
                    </div>
                    <button className="text-green-600 hover:text-green-700">
                      Selecionar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Criar Nova Instância */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Criar Nova Instância
              </h4>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="Nome da nova instância"
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={createNewInstance}
                  disabled={isCreatingInstance || !newInstanceName.trim()}
                  className="btn-primary px-4"
                >
                  {isCreatingInstance ? (
                    <Spinner size="sm" color="white" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary flex-1 flex justify-center items-center"
          >
            {isLoading ? (
              <Spinner size="md" color="white" />
            ) : (
              "Salvar Configuração"
            )}
          </button>

          <button
            type="button"
            onClick={testConnection}
            disabled={isTesting || !config}
            className="btn-secondary flex-1 flex justify-center items-center"
          >
            {isTesting ? (
              <Spinner size="md" color="secondary" />
            ) : (
              <>Testar Conexão</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
