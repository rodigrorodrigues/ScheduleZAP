import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, User, Trash2, Send, Play } from "lucide-react";
import { scheduledAPI, ScheduledMessage } from "../services/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import toast from "react-hot-toast";

export default function ScheduledMessages() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [filter, setFilter] = useState<
    "all" | "pending" | "sent" | "cancelled"
  >("all");
  const [isProcessing, setIsProcessing] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    const messagesList = await scheduledAPI.getScheduledMessages();
    setMessages(messagesList);
  };

  const handleCancelMessage = async (messageId: string) => {
    if (window.confirm("Tem certeza que deseja cancelar este agendamento?")) {
      await scheduledAPI.cancelScheduledMessage(messageId);
      await loadMessages();
    }
  };

  const filteredMessages = messages.filter((message) => {
    if (filter === "all") return true;
    return message.status === filter;
  });

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

  // Função para formatar apenas a data no fuso de São Paulo
  const formatDateOnlyInSP = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "sent":
        return <Send className="h-4 w-4" />;
      case "cancelled":
        return <Trash2 className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Mensagens Agendadas
          </h1>
          <p className="text-gray-600">
            Gerencie seus agendamentos de mensagens
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          {/* Remover handleProcessMessages e botão relacionado */}
          <button onClick={() => navigate("/schedule")} className="btn-primary">
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "Todas" },
            { value: "pending", label: "Pendentes" },
            { value: "sent", label: "Enviadas" },
            { value: "cancelled", label: "Canceladas" },
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => setFilter(filterOption.value as any)}
              className={
                filter === filterOption.value
                  ? "px-3 py-1 rounded-full text-sm font-medium transition-colors bg-green-100 text-green-700"
                  : "px-3 py-1 rounded-full text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
              }
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Mensagens */}
      <div className="grid gap-4">
        {filteredMessages.map((message) => (
          <div
            key={message.id}
            className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-4">
                {getStatusIcon(message.status)}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {message.message}
                </p>
                <p className="text-sm text-gray-600">
                  Data: {formatDateInSP(message.scheduledAt)}
                </p>
                <p className="text-sm text-gray-600">
                  Status:{" "}
                  <span className={`${getStatusColor(message.status)}`}>
                    {getStatusText(message.status)}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCancelMessage(message.id)}
                className="text-red-600 hover:text-red-900"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
