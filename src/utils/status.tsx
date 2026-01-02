import { CheckCircle, Clock, XCircle, AlertCircle, WifiOff } from "lucide-react";

// Use the same type as defined in api.ts for consistency
export type MessageStatus = "sent" | "pending" | "cancelled" | "failed";
export type ConnectionStatus = "connected" | "disconnected" | "testing" | null;

/**
 * Get the icon component for a message status
 */
export function getMessageStatusIcon(status: MessageStatus) {
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
}

/**
 * Get the text label for a message status
 */
export function getMessageStatusText(status: MessageStatus): string {
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
}

/**
 * Get the CSS color class for a message status
 */
export function getMessageStatusColor(status: MessageStatus): string {
  switch (status) {
    case "sent":
      return "text-green-600";
    case "pending":
      return "text-yellow-600";
    case "cancelled":
    case "failed":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}

/**
 * Get the icon component for a connection status
 */
export function getConnectionStatusIcon(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "disconnected":
      return <WifiOff className="h-5 w-5 text-red-600" />;
    case "testing":
      return (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
      );
    default:
      return <AlertCircle className="h-5 w-5 text-gray-400" />;
  }
}

/**
 * Get the text label for a connection status
 */
export function getConnectionStatusText(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Conectado";
    case "disconnected":
      return "Desconectado";
    case "testing":
      return "Testando...";
    default:
      return "Não configurado";
  }
}

/**
 * Get the CSS color class for a connection status
 */
export function getConnectionStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "text-green-600";
    case "disconnected":
      return "text-red-600";
    case "testing":
      return "text-blue-600";
    default:
      return "text-gray-400";
  }
}

/**
 * Get the CSS color class for an instance status
 */
export function getInstanceStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "text-green-600";
    case "connecting":
      return "text-yellow-600";
    case "close":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}
