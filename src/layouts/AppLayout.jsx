import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, X, WifiOff } from "lucide-react";
import { useAuth } from "../contexts/auth";
import { useClinic, useSearch } from "../contexts/clinic";
import Sidebar from "../components/Sidebar";
import VisitDrawer from "../components/VisitDrawer";
import Toasts from "../components/Toasts";
import IdleWarning from "../components/IdleWarning";
import { useIdleTimeout } from "../hooks/useIdleTimeout";
import { IDLE_MINUTES, IDLE_WARN_MS, idleTimeoutMs } from "../config/app";
import { EASE } from "../utils/motion";
import "../styles/app.css";
import "../styles/overlays.css";

// páginas que exibem a tabela filtrada pela busca
const SEARCHABLE = ["/dashboard"];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { online } = useClinic();
  const { query, setQuery } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const searchRef = useRef(null);

  // atalho "/" foca a busca
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSearchKey(e) {
    if (e.key === "Enter" && !SEARCHABLE.includes(location.pathname)) {
      navigate("/dashboard");
    }
    if (e.key === "Escape") {
      setQuery("");
      e.currentTarget.blur();
    }
  }

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  // sessão encerrada por inatividade
  const [timeoutMs] = useState(idleTimeoutMs);
  const onIdle = useCallback(() => {
    // o redirecionamento da rota privada descarta o state da navegação;
    // o motivo vai pelo sessionStorage e o login lê uma vez
    try {
      sessionStorage.setItem("sinco:logout-reason", "idle");
    } catch {
      /* ignora */
    }
    signOut();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);
  const idle = useIdleTimeout({
    timeoutMs,
    warnMs: Math.min(IDLE_WARN_MS, timeoutMs / 2),
    onTimeout: onIdle,
  });

  return (
    <div className="dash">
      <Sidebar
        open={menuOpen}
        onClose={closeMenu}
        user={user}
        onSignOut={handleSignOut}
      />

      <div className="dash-main">
        {/* brilhos de fundo, mesma linguagem do login */}
        <div className="dash-bg" aria-hidden="true">
          <div className="dash-glow dash-glow--a" />
          <div className="dash-glow dash-glow--b" />
        </div>

        <motion.div
          className="topbar"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <button
            className="menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
          >
            <Menu size={20} />
          </button>
          <motion.label
            className="search"
            whileHover={{ scale: 1.005 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <Search size={16} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Pesquisar paciente, CPF, protocolo..."
              aria-label="Pesquisar atendimentos"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKey}
            />
            <AnimatePresence mode="wait" initial={false}>
              {query ? (
                <motion.button
                  key="clear"
                  type="button"
                  className="search-clear"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Limpar busca"
                  initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                  transition={{ duration: 0.18 }}
                >
                  <X size={14} />
                </motion.button>
              ) : (
                <motion.kbd
                  key="kbd"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  /
                </motion.kbd>
              )}
            </AnimatePresence>
          </motion.label>
        </motion.div>

        {/* transição entre páginas */}
        {!online && (
          <div className="offline-bar" role="status" aria-live="polite">
            <WifiOff size={14} /> Sem conexão. Você pode continuar lendo; registros serão bloqueados até a rede voltar.
          </div>
        )}

        <motion.div
          key={location.pathname}
          className="page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {outlet}
        </motion.div>
      </div>

      <VisitDrawer />
      <Toasts />
      <IdleWarning
        open={idle.warning}
        remaining={idle.remaining}
        minutes={timeoutMs >= 60000 ? Math.round(timeoutMs / 60000) : IDLE_MINUTES}
        onStay={idle.stayActive}
        onLeave={handleSignOut}
      />
    </div>
  );
}
