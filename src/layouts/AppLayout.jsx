import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useClinic } from "../contexts/clinic";
import Sidebar from "../components/Sidebar";
import VisitDrawer from "../components/VisitDrawer";
import Toasts from "../components/Toasts";
import { EASE, pulse } from "../utils/motion";
import "../styles/app.css";
import "../styles/overlays.css";

// páginas que exibem a tabela filtrada pela busca
const SEARCHABLE = ["/dashboard"];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { query, setQuery } = useClinic();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const [menuOpen, setMenuOpen] = useState(false);
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

  return (
    <div className="dash">
      <Sidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        onSignOut={handleSignOut}
      />

      <div className="dash-main">
        {/* brilhos de fundo, mesma linguagem do login */}
        <div className="dash-bg" aria-hidden="true">
          <motion.div
            className="dash-glow dash-glow--a"
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.96, 1.04, 0.96] }}
            transition={pulse(9)}
          />
          <motion.div
            className="dash-glow dash-glow--b"
            animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.08, 1] }}
            transition={pulse(7, 1.5)}
          />
        </div>

        <motion.div
          className="topbar"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="page"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </div>

      <VisitDrawer />
      <Toasts />
    </div>
  );
}
