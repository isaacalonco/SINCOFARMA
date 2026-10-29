import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, UserRound, Database, TriangleAlert, FileText } from "lucide-react";
import { useClinic } from "../contexts/clinic";
import { STATUS } from "../data/catalog";
import { initials } from "../utils/initials";
import { useFocusTrap, useModalBackdrop } from "../hooks/useFocusTrap";
import { useAuth } from "../contexts/auth";
import { podeAlterar, podeRota } from "../services/permissoes";
import { Link } from "react-router-dom";

export default function VisitDrawer() {
  const { visits, selectedId, closeVisit, updateVisit, notify } = useClinic();
  const { user } = useAuth();
  const visit = visits.find((v) => v.id === selectedId);
  // desfecho e Red Flag: só quem registrou (o servidor recusa os demais)
  const editable = podeAlterar(user, visit);
  const panelRef = useRef(null);
  useFocusTrap(panelRef, !!visit, { onClose: closeVisit, initialFocus: ".drawer-head h2" });
  useModalBackdrop(!!visit, ".drawer, .drawer-scrim, .toasts");

  async function setStatus(status) {
    if (status === visit.status) return;
    try {
      await updateVisit(visit.id, { status });
      notify(`Desfecho de ${visit.name.split(" ")[0]}: ${STATUS[status].label}.`, "success");
    } catch {
      /* o provider já avisou e desfez */
    }
  }

  async function toggleUrgent() {
    const wasUrgent = !!visit.urgent;
    try {
      await updateVisit(visit.id, { urgent: !wasUrgent });
      notify(wasUrgent ? "Red Flag removida." : "Red Flag ativada.", wasUrgent ? "info" : "warn");
    } catch {
      /* idem */
    }
  }

  return (
    <AnimatePresence>
      {visit && (
        <>
          <motion.div
            className="drawer-scrim"
            onClick={closeVisit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            ref={panelRef}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Atendimento de ${visit.name}${visit.urgent ? " (urgente)" : ""}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
          >
            <header className="drawer-head">
              <span className={`avatar avatar--lg avatar--${visit.urgent ? "red" : STATUS[visit.status].tone}`}>
                {initials(visit.name)}
              </span>
              <div>
                <h2 tabIndex={-1}>{visit.name}</h2>
                <small className="mono">CPF {visit.cpf}</small>
              </div>
              <button className="icon-btn" onClick={closeVisit} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            <div className="drawer-body">
              {podeRota(user, "/ficha") && (
                <Link to={`/ficha/${visit.id}`} className="btn btn--ghost drawer-ficha" onClick={closeVisit}>
                  <FileText size={16} /> Abrir ficha completa
                </Link>
              )}

              <dl className="meta-grid">
                <div>
                  <dt><Clock size={14} /> Horário</dt>
                  <dd className="mono">{visit.time}</dd>
                </div>
                <div>
                  <dt><UserRound size={14} /> RT responsável</dt>
                  <dd>{visit.rt}</dd>
                </div>
                <div>
                  <dt><Database size={14} /> Origem</dt>
                  <dd>{visit.source === "RNDS" ? "Importado da RNDS" : "Registro na unidade"}</dd>
                </div>
              </dl>

              <section className={`complaint-box${visit.urgent ? " is-urgent" : ""}`}>
                <h3>Queixa principal</h3>
                <p>{visit.complaint}</p>
                <h3>Sinais e observações</h3>
                <p>{visit.signs || "Sem observações registradas."}</p>
              </section>

              {!editable && (
                <p className="drawer-readonly" role="note">
                  Só quem registrou este atendimento pode mudar o desfecho e a Red Flag.
                </p>
              )}
              <fieldset className="field" disabled={!editable}>
                <legend>DESFECHO</legend>
                <div className="segmented segmented--stack">
                  {Object.entries(STATUS).map(([key, s]) => (
                    <button
                      type="button"
                      key={key}
                      className={`seg seg--${s.tone}${visit.status === key ? " is-active" : ""}`}
                      onClick={() => setStatus(key)}
                      aria-pressed={visit.status === key}
                    >
                      {visit.status === key && (
                        <motion.span
                          layoutId="seg-drawer"
                          className="seg-bg"
                          transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                      )}
                      <span className="seg-label">
                        <i className={`status-dot status-dot--${s.tone}`} />
                        {s.label}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                className={`flag-toggle${visit.urgent ? " is-on" : ""}`}
                onClick={toggleUrgent}
                aria-pressed={!!visit.urgent}
                disabled={!editable}
              >
                <span className="switch"><i /></span>
                <TriangleAlert size={16} />
                <span>
                  <b>Red Flag</b> · sinal de alerta
                </span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
