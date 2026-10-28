import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  ClipboardList,
  Stethoscope,
  CircleArrowOutUpRight,
  Store,
  ChartColumn,
  LogOut,
  X,
} from "lucide-react";
import logo from "../assets/logo-sincofarma.webp";
import { useClinic } from "../contexts/clinic";
import { initials } from "../utils/initials";
import { EASE, SPRING } from "../utils/motion";
import { useFocusTrap } from "../hooks/useFocusTrap";
import MotionToggle from "./MotionToggle";
import { isReady } from "../config/app";

const MOBILE = "(max-width: 1024px)";

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia?.(MOBILE).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE);
    if (!mq) return undefined;
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

export default function Sidebar({ open, onClose, user, onSignOut }) {
  const { stats } = useClinic();
  const mobile = useIsMobile();
  const asideRef = useRef(null);
  // no mobile a gaveta aberta vira um diálogo: foco preso, Esc fecha, foco volta ao botão
  useFocusTrap(asideRef, mobile && open, { onClose, initialFocus: ".sb-close" });
  // fechada no mobile, sai do tab order e dos leitores de tela
  const inert = mobile && !open;

  const sections = [
    {
      title: "PRINCIPAL",
      items: [
        { label: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
        { label: "Atendimentos", icon: ClipboardList, to: "/atendimentos", badge: stats.waiting },
        { label: "Nova Triagem", icon: Stethoscope, to: "/nova-triagem" },
        {
          label: "Encaminhamentos",
          icon: CircleArrowOutUpRight,
          to: "/encaminhamentos",
          badge: stats.urgentToday,
          badgeTone: "red",
        },
      ],
    },
    {
      title: "GESTÃO",
      items: [
        { label: "Farmácias", icon: Store, to: "/farmacias" },
        { label: "Relatórios", icon: ChartColumn, to: "/relatorios" },
      ],
    },
  ];

  // índice contínuo para a cascata de entrada
  const offsets = sections.map((_, i) =>
    sections.slice(0, i).reduce((n, s) => n + s.items.length, 0)
  );

  return (
    <>
      <div className={`sb-scrim${open ? " is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={asideRef}
        id="app-sidebar"
        className={`sidebar${open ? " is-open" : ""}`}
        aria-label="Menu principal"
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile && open ? "true" : undefined}
        inert={inert || undefined}
      >
        <motion.div
          className="sb-brand"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <motion.img
            src={logo}
            alt="Sincofarma DF"
            whileHover={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          />
          <button className="sb-close" onClick={onClose} aria-label="Fechar menu">
            <X size={18} />
          </button>
        </motion.div>

        <nav className="sb-nav">
          {sections.map((section, si) => (
            <div key={section.title} className="sb-section">
              <motion.p
                className="sb-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + offsets[si] * 0.05, duration: 0.5 }}
              >
                {section.title}
              </motion.p>
              <ul>
                {section.items.map(({ label, icon: Icon, to, badge, badgeTone }, ii) => (
                  <motion.li
                    key={label}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + (offsets[si] + ii) * 0.05, duration: 0.55, ease: EASE }}
                  >
                    <NavLink
                      to={to}
                      onClick={onClose}
                      className={({ isActive }) => `sb-link${isActive ? " is-active" : ""}`}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.span
                              layoutId="sb-active"
                              className="sb-active-bg"
                              transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            />
                          )}
                          <Icon size={18} />
                          <span className="sb-label">{label}</span>
                          {!isReady(to) && <span className="sb-soon">em breve</span>}
                          {isReady(to) && badge > 0 && (
                            <motion.span
                              key={badge}
                              className={`sb-badge${badgeTone ? ` sb-badge--${badgeTone}` : ""}`}
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 18 }}
                            >
                              {badge}
                            </motion.span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <motion.div
          className="sb-user"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
        >
          <span className="sb-avatar">{initials(user?.name) || "RT"}</span>
          <div className="sb-user-info">
            <strong>{user?.name ?? "Farmacêutico RT"}</strong>
            <small>{user?.crf ?? "CRF-DF · RT"}</small>
          </div>
          <MotionToggle className="sb-motion" />
          <motion.button
            className="sb-logout"
            onClick={onSignOut}
            aria-label="Sair"
            title="Sair"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.9 }}
            transition={SPRING}
          >
            <LogOut size={16} />
          </motion.button>
        </motion.div>
      </aside>
    </>
  );
}
