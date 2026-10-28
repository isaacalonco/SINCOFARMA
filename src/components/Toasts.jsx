import { motion, AnimatePresence } from "framer-motion";
import { CircleCheck, Info, TriangleAlert, CircleX, X } from "lucide-react";
import { useToasts } from "../contexts/clinic";

const ICONS = { success: CircleCheck, info: Info, warn: TriangleAlert, error: CircleX };

export default function Toasts() {
  const { toasts, dismissToast } = useToasts();

  return (
    <div className="toasts" aria-live="assertive">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] ?? Info;
          return (
            <motion.div
              key={t.id}
              layout
              className={`toast toast--${t.tone}`}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
            >
              <Icon size={16} />
              <span>{t.message}</span>
              <button onClick={() => dismissToast(t.id)} aria-label="Fechar aviso">
                <X size={14} />
              </button>
              <motion.i
                className="toast-timer"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: t.tone === "error" ? 6 : 3.8, ease: "linear" }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
