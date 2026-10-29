import { motion } from "framer-motion";
import { ShieldOff } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { rise } from "../../utils/motion";

/** Login sem nenhum papel (`papel:*`) ou papel sem tela própria ainda. */
export default function SemAcesso() {
  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.h1 {...rise(0)}>Sem acesso</motion.h1>
        </div>
      </section>
      <SpotlightCard index={1} className="soon">
        <span className="soon-icon">
          <span className="soon-icon-inner">
            <ShieldOff size={30} />
          </span>
        </span>
        <motion.h2 {...rise(0, 0.3)}>Seu perfil ainda não tem telas liberadas</motion.h2>
        <motion.p {...rise(1, 0.3)}>
          Procure a administração do Sincofarma para confirmar seu perfil de acesso.
        </motion.p>
      </SpotlightCard>
    </main>
  );
}
