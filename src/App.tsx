import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/Login";
import ScheduleMessage from "./pages/ScheduleMessage";
import ScheduledMessages from "./pages/ScheduledMessages";
import Settings from "./pages/Settings";
import { AuthProvider, RequireAuth } from "./contexts/AuthContext";
import { localAPI } from "./services/api";

// Iniciar processador de mensagens
localAPI.startMessageProcessor();

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas */}
          <Route
            path="/schedule"
            element={
              <RequireAuth>
                <ScheduleMessage />
              </RequireAuth>
            }
          />
          <Route
            path="/scheduled-messages"
            element={
              <RequireAuth>
                <ScheduledMessages />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />

          {/* Redirecionar raiz para mensagens agendadas */}
          <Route
            path="/"
            element={<Navigate to="/scheduled-messages" replace />}
          />

          {/* Redirecionar qualquer outra rota para mensagens agendadas */}
          <Route
            path="*"
            element={<Navigate to="/scheduled-messages" replace />}
          />
        </Routes>

        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
