import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/Login";
import ScheduleMessage from "./pages/ScheduleMessage";
import ScheduledMessages from "./pages/ScheduledMessages";
import Settings from "./pages/Settings";
import { AuthProvider, RequireAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Rotas protegidas */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<ScheduledMessages />} />
            <Route path="/schedule" element={<ScheduleMessage />} />
            <Route path="/settings" element={<Settings />} />

            {/* Redirecionar qualquer outra rota para a raiz */}
            <Route path="*" element={<ScheduledMessages />} />
          </Route>
        </Routes>

        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
