import { Link, useLocation } from "react-router-dom";
import { MessageSquarePlus, List, Settings } from "lucide-react";

export default function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const linkClass = (path: string) => {
    return `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
      isActive(path)
        ? "bg-primary text-white"
        : "text-gray-600 hover:bg-gray-100"
    }`;
  };

  return (
    <nav className="flex flex-col gap-2 p-4">
      <Link to="/schedule" className={linkClass("/schedule")}>
        <MessageSquarePlus className="w-5 h-5" />
        <span>Agendar Mensagem</span>
      </Link>

      <Link
        to="/scheduled-messages"
        className={linkClass("/scheduled-messages")}
      >
        <List className="w-5 h-5" />
        <span>Mensagens Agendadas</span>
      </Link>

      <Link to="/settings" className={linkClass("/settings")}>
        <Settings className="w-5 h-5" />
        <span>Configurações</span>
      </Link>
    </nav>
  );
}
