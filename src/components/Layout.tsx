import { Outlet } from "react-router-dom";
import Navigation from "./Navigation";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white border-r">
          <div className="p-4 border-b">
            <h1 className="text-xl font-bold text-gray-800">ScheduleZAP</h1>
          </div>
          <Navigation />
          <div className="p-4 mt-auto border-t">
            <button
              onClick={logout}
              className="w-full px-4 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50"
            >
              Sair
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-screen">
          <div className="container p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
