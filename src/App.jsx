import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import EmBreve from "./pages/EmBreve/EmBreve";
import NovaTriagem from "./pages/NovaTriagem/NovaTriagem";
import AppLayout from "./layouts/AppLayout";
import { ClinicProvider } from "./contexts/ClinicProvider";
import { useAuth } from "./contexts/AuthContext";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <PrivateRoute>
            <ClinicProvider>
              <AppLayout />
            </ClinicProvider>
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/atendimentos" element={<EmBreve title="Atendimentos" />} />
        <Route path="/nova-triagem" element={<NovaTriagem />} />
        <Route path="/encaminhamentos" element={<EmBreve title="Encaminhamentos" />} />
        <Route path="/farmacias" element={<EmBreve title="Farmácias" />} />
        <Route path="/relatorios" element={<EmBreve title="Relatórios" />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
