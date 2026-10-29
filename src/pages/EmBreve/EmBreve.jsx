import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Construction, ArrowLeft } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { rise, press, pulse } from "../../utils/motion";
import { useAuth } from "../../contexts/auth";
import { rotaInicial } from "../../services/permissoes";

const MotionLink = motion.create(Link);

export default function EmBreve({ title }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  // a tela inicial depende do perfil; nela o botão não tem para onde voltar
  const home = rotaInicial(user);
  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>{title}</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>{title}</motion.h1>
        </div>
      </section>

      <SpotlightCard index={1} className="soon">
        <motion.span
          className="soon-icon"
          initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.3 }}
        >
          <motion.span
            className="soon-icon-inner"
            animate={{ rotate: [0, -8, 8, -4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.2, delay: 1 }}
          >
            <Construction size={30} />
          </motion.span>
          <motion.i
            className="soon-ring"
            animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        </motion.span>
        <motion.h2 {...rise(0, 0.4)}>Módulo em construção</motion.h2>
        <motion.p {...rise(1, 0.4)}>
          A área de <b>{title}</b> ainda está sendo desenvolvida e estará disponível em breve.
        </motion.p>
        <motion.div className="soon-progress" {...rise(2, 0.4)} aria-hidden="true">
          <motion.span
            animate={{ x: ["-100%", "220%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
        {pathname !== home && (
          <motion.div {...rise(3, 0.4)}>
            <MotionLink to={home} className="btn btn--ghost" {...press}>
              <ArrowLeft size={16} /> Voltar ao início
            </MotionLink>
          </motion.div>
        )}
        <motion.span
          className="soon-glow"
          aria-hidden="true"
          animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.95, 1.08, 0.95] }}
          transition={pulse(5)}
        />
      </SpotlightCard>
    </main>
  );
}
