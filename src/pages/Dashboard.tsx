import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Calendar, Clock, Send, Settings } from "lucide-react";
import { scheduledAPI, ScheduledMessage, localAPI } from "../services/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const [scheduledMessages, setScheduledMessages] = useState<
    ScheduledMessage[]
  >([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    sent: 0,
    cancelled: 0,
  });
  const [isConfigured, setIsConfigured] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      await loadData();
      checkConfiguration();
    })();
  }, []);

  const loadData = async () => {
    const messages = await scheduledAPI.getScheduledMessages();
    setScheduledMessages(messages);

    const stats = {
      total: messages.length,
      pending: messages.filter((m) => m.status === "pending").length,
      sent: messages.filter((m) => m.status === "sent").length,
      cancelled: messages.filter((m) => m.status === "cancelled").length,
    };
    setStats(stats);
  };

  const checkConfiguration = () => {
    const config = localAPI.getEvolutionConfig();
    setIsConfigured(
      Boolean(
        config.apiUrl &&
          config.instanceName &&
          config.token &&
          config.isConnected
      )
    );
  };

  // Função para formatar data no fuso de São Paulo
  const formatDateInSP = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "status-pending";
      case "sent":
        return "status-sent";
      case "cancelled":
        return "status-cancelled";
      default:
        return "status-pending";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "sent":
        return "Enviada";
      case "cancelled":
        return "Cancelada";
      default:
        return "Desconhecido";
    }
  };

  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Visão geral das mensagens agendadas</p>
        </div>

        <div className="card text-center py-12">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Configure a Evolution API v2
          </h3>
          <p className="text-gray-500 mb-6">
            Para começar a usar o ScheduleZAP, configure a conexão com a
            Evolution API v2 incluindo o token de autenticação
          </p>
          <button onClick={() => navigate("/settings")} className="btn-primary">
            Ir para Configurações
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Visão geral das mensagens agendadas</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="flex flex-col items-center">
            <MessageSquare className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-sm font-medium text-gray-500">Total</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.total}
            </p>
          </div>
        </div>

        <div className="card text-center">
          <div className="flex flex-col items-center">
            <Clock className="h-8 w-8 text-yellow-600 mb-2" />
            <p className="text-sm font-medium text-gray-500">Pendentes</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.pending}
            </p>
          </div>
        </div>

        <div className="card text-center">
          <div className="flex flex-col items-center">
            <Send className="h-8 w-8 text-green-600 mb-2" />
            <p className="text-sm font-medium text-gray-500">Enviadas</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.sent}</p>
          </div>
        </div>

        <div className="card text-center">
          <div className="flex flex-col items-center">
            <Calendar className="h-8 w-8 text-red-600 mb-2" />
            <p className="text-sm font-medium text-gray-500">Canceladas</p>
            <p className="text-2xl font-semibold text-gray-900">
              {stats.cancelled}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/schedule")}
          className="card hover:shadow-md transition-shadow cursor-pointer text-center"
        >
          <div className="flex flex-col items-center">
            <MessageSquare className="h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Agendar Nova Mensagem
            </h3>
            <p className="text-sm text-gray-500">Criar um novo agendamento</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/scheduled")}
          className="card hover:shadow-md transition-shadow cursor-pointer text-center"
        >
          <div className="flex flex-col items-center">
            <Calendar className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Ver Agendamentos
            </h3>
            <p className="text-sm text-gray-500">
              Gerenciar mensagens agendadas
            </p>
          </div>
        </button>
      </div>

      {/* Recent Messages */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Mensagens Recentes
        </h3>
        {scheduledMessages.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nenhuma mensagem agendada ainda
          </p>
        ) : (
          <div className="space-y-3">
            {scheduledMessages.slice(0, 5).map((message) => (
              <div
                key={message.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {message.contact.name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {message.message}
                  </p>
                  <p className="text-xs text-gray-400">
                    Agendado para: {formatDateInSP(message.scheduledAt)}
                  </p>
                </div>
                <span className={`${getStatusColor(message.status)}`}>
                  {getStatusText(message.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
