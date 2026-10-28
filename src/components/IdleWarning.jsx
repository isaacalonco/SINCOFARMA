import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock3, LogOut } from "lucide-react";
import { useFocusTrap, useModalBackdrop } from "../hooks/useFocusTrap";

const fmt = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Aviso de sessão prestes a expirar, com contagem regressiva. */
export default function IdleWarning({ open, remaining, onStay, onLeave, minutes }) {
  const ref = useRef(null);
  useFocusTrap(ref, open, { onClose: onStay, initialFocus: ".idle-stay" });
  useModalBackdrop(open, ".idle-overlay, .toasts");

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay idle-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            ref={ref}
            className="modal idle-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="idle-title"
            aria-describedby="idle-desc"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <span className="idle-icon" aria-hidden="true"><Clock3 size={26} /></span>
            <h2 id="idle-title">Sua sessão vai expirar</h2>
            <p id="idle-desc">
              Por segurança, a sessão é encerrada após {minutes} minutos sem atividade.
              Saída automática em <strong className="idle-count">{fmt(remaining)}</strong>.
            </p>
            <div className="idle-actions">
              <button type="button" className="btn btn--ghost" onClick={onLeave}>
                <LogOut size={16} /> Sair agora
              </button>
              <button type="button" className="btn btn--primary idle-stay" onClick={onStay}>
                Continuar conectado
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
