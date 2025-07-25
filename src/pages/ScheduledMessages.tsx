import { useEffect, useState } from "react";
import { scheduledAPI, ScheduledMessage } from "../services/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function ScheduledMessages() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await scheduledAPI.getScheduledMessages();
      setMessages(data);
    } catch (error: any) {
      console.error("❌ Erro ao carregar agendamentos:", error);
      setError(error.message || "Erro ao carregar agendamentos");
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMessage = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) {
      return;
    }

    try {
      await scheduledAPI.cancelScheduledMessage(id);
      toast.success("Agendamento cancelado!");
      loadMessages();
    } catch (error: any) {
      console.error("❌ Erro ao cancelar agendamento:", error);
      toast.error(error.message || "Erro ao cancelar agendamento");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "sent":
        return "Enviada";
      case "pending":
        return "Aguardando";
      case "cancelled":
        return "Cancelada";
      case "failed":
        return "Falha";
      default:
        return status;
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-600">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>{error}</p>
        <button
          onClick={loadMessages}
          className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Clock className="h-8 w-8 mb-2" />
        <p>Nenhuma mensagem agendada</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Mensagens Agendadas</h2>
      <div className="grid gap-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className="bg-white rounded-lg shadow p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(message.status)}
                <span
                  className={`font-medium ${
                    message.status === "sent"
                      ? "text-green-600"
                      : message.status === "pending"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {getStatusText(message.status)}
                </span>
              </div>
              {message.status === "pending" && (
                <button
                  onClick={() => handleCancelMessage(message.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Cancelar agendamento"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="grid gap-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Contato:</span>
                <span className="font-medium">{message.contact.number}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Agendado para:</span>
                <span className="font-medium">
                  {formatDate(message.scheduledAt)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Criado em:</span>
                <span className="font-medium">
                  {formatDate(message.createdAt)}
                </span>
              </div>
              {message.processedAt && (
                <div className="flex justify-between text-gray-600">
                  <span>Processado em:</span>
                  <span className="font-medium">
                    {formatDate(message.processedAt)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-2 p-2 bg-gray-50 rounded text-gray-700">
              {message.message}
            </div>

            {message.error && (
              <div className="mt-2 p-2 bg-red-50 text-red-700 rounded text-sm">
                <div className="font-medium">Erro:</div>
                {message.error}
              </div>
            )}

            <div className="mt-2 text-xs text-gray-500">
              <div>API: {message.apiUrl}</div>
              <div>Instância: {message.instance}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
