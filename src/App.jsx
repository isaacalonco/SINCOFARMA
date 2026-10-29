import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { ClinicProvider } from "./contexts/ClinicProvider";
import { useAuth } from "./contexts/auth";
import RouteFallback from "./components/RouteFallback";
import { podeRota, rotaInicial } from "./services/permissoes";
import { appPages, loaders } from "./pages/loaders";

const Login = lazy(loaders.Login);
const Dashboard = lazy(loaders.Dashboard);
const NovaTriagem = lazy(loaders.NovaTriagem);
const EmBreve = lazy(loaders.EmBreve);
const SemAcesso = lazy(loaders.SemAcesso);
const Usuarios = lazy(loaders.Usuarios);
const MinhaConta = lazy(loaders.MinhaConta);
const Ficha = lazy(loaders.Ficha);
const Auditoria = lazy(loaders.Auditoria);

/* Depois que o app estiver logado e ocioso, baixa as outras páginas em
   segundo plano para a troca de rota ser instantânea. */
function usePreloadPages(enabled) {
  useEffect(() => {
    if (!enabled) return;
    // só as páginas internas (o login já não é necessário)
    const run = () => appPages.forEach((load) => load());
    const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 1500));
    const handle = idle(run);
    return () => (window.cancelIdleCallback ?? clearTimeout)(handle);
  }, [enabled]);
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/** Tela fora do perfil do usuário: volta para a primeira que ele pode abrir. */
function Permitida({ path, children }) {
  const { user } = useAuth();
  return podeRota(user, path) ? children : <Navigate to={rotaInicial(user)} replace />;
}

/** Destino padrão de quem está logado (depende do perfil). */
function Inicio() {
  const { user } = useAuth();
  return <Navigate to={user ? rotaInicial(user) : "/login"} replace />;
}

/** Quem já está logado não vê a tela de login. */
function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to={rotaInicial(user)} replace /> : children;
}

// rota -> página (a permissão de cada uma está em services/permissoes.js)
const PAGINAS = [
  ["/dashboard", <Dashboard />],
  ["/atendimentos", <EmBreve title="Atendimentos" />],
  ["/nova-triagem", <NovaTriagem />],
  ["/encaminhamentos", <EmBreve title="Encaminhamentos" />],
  ["/farmacias", <EmBreve title="Farmácias" />],
  ["/relatorios", <EmBreve title="Relatórios" />],
  ["/usuarios", <Usuarios />],
  ["/minha-conta", <MinhaConta />],
  ["/auditoria", <Auditoria />],
  // rota com parâmetro: a permissão é a de "/ficha"
  ["/ficha/:id", <Ficha />, "/ficha"],
];

export default function App() {
  const { user } = useAuth();
  usePreloadPages(!!user);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/" element={<Inicio />} />
        <Route
          element={
            <PrivateRoute>
              <ClinicProvider>
                <AppLayout />
              </ClinicProvider>
            </PrivateRoute>
          }
        >
          {PAGINAS.map(([path, page, perm = path]) => (
            <Route key={path} path={path} element={<Permitida path={perm}>{page}</Permitida>} />
          ))}
          <Route path="/sem-acesso" element={<SemAcesso />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
