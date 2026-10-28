import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { ClinicProvider } from "./contexts/ClinicProvider";
import { useAuth } from "./contexts/auth";
import RouteFallback from "./components/RouteFallback";

// cada página vira um chunk separado: o login não baixa o código do painel
const loaders = {
  Login: () => import("./pages/Login/Login"),
  Dashboard: () => import("./pages/Dashboard/Dashboard"),
  NovaTriagem: () => import("./pages/NovaTriagem/NovaTriagem"),
  EmBreve: () => import("./pages/EmBreve/EmBreve"),
};
const Login = lazy(loaders.Login);
const Dashboard = lazy(loaders.Dashboard);
const NovaTriagem = lazy(loaders.NovaTriagem);
const EmBreve = lazy(loaders.EmBreve);

/* Depois que o app estiver logado e ocioso, baixa as outras páginas em
   segundo plano para a troca de rota ser instantânea. */
function usePreloadPages(enabled) {
  useEffect(() => {
    if (!enabled) return;
    const run = () => Object.values(loaders).forEach((load) => load());
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1500));
    const handle = idle(run);
    return () => (window.cancelIdleCallback ?? clearTimeout)(handle);
  }, [enabled]);
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/** Quem já está logado não vê a tela de login. */
function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const { user } = useAuth();
  usePreloadPages(!!user);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
    </Suspense>
  );
}
