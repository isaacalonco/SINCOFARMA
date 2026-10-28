import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { EASE, SPRING } from "../../utils/motion";
import { STEP_STATUS_LABEL } from "./constants";

export default function Stepper({ steps, onGo }) {
  return (
    <motion.nav
      className="tg-card"
      aria-label="Etapas do atendimento"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
    >
      <ol className="tg-steps">
        {steps.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.5, ease: EASE }}
          >
            <motion.button
              type="button"
              className={`tg-step tg-step--${s.status}`}
              aria-current={s.status === "active" ? "step" : undefined}
              onClick={() => onGo(s.target)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={s.status}
                  className="tg-step-dot"
                  aria-hidden="true"
                  initial={{ scale: 0.4, rotate: -40, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0.4, rotate: 40, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                >
                  {s.status === "done" ? <Check size={14} strokeWidth={3} /> : s.n}
                </motion.span>
              </AnimatePresence>
              <span>
                <span className="tg-step-state">Etapa {s.n} · {STEP_STATUS_LABEL[s.status]}</span>
                <span className="tg-step-title">{s.title}</span>
              </span>
            </motion.button>
          </motion.li>
        ))}
      </ol>
    </motion.nav>
  );
}
