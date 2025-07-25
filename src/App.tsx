import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { localAPI } from "./services/api";
import { useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ScheduleMessage from "./pages/ScheduleMessage";
import ScheduledMessages from "./pages/ScheduledMessages";
import Settings from "./pages/Settings";
import Layout from "./components/Layout";
import UserConfig from "./pages/UserConfig";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  // Iniciar o processamento automático de mensagens quando o usuário estiver logado
  useEffect(() => {
    // Iniciar o processador de mensagens agendadas
    localAPI.startMessageProcessor();

    console.log("🔄 Processador de mensagens agendadas iniciado");
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="schedule" element={<ScheduleMessage />} />
        <Route path="scheduled" element={<ScheduledMessages />} />
        <Route path="scheduled-messages" element={<ScheduledMessages />} />
        <Route path="settings" element={<Settings />} />
        <Route path="user-config" element={<UserConfig />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#363636",
              color: "#fff",
            },
          }}
        />
      </div>
    </AuthProvider>
  );
}

export default App;
