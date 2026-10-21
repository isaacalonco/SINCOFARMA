import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, UserRound, Database, TriangleAlert } from "lucide-react";
import { useClinic } from "../contexts/clinic";
import { STATUS } from "../pages/Dashboard/data";
import { initials } from "../utils/initials";

export default function VisitDrawer() {
  const { visits, selectedId, closeVisit, updateVisit, notify } = useClinic();
  const visit = visits.find((v) => v.id === selectedId);

  useEffect(() => {
    if (!visit) return;
    const onKey = (e) => e.key === "Escape" && closeVisit();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visit, closeVisit]);

  function setStatus(status) {
    if (status === visit.status) return;
    updateVisit(visit.id, { status });
    notify(`Desfecho de ${visit.name.split(" ")[0]}: ${STATUS[status].label}.`, "success");
  }

  function toggleUrgent() {
    updateVisit(visit.id, { urgent: !visit.urgent });
    notify(visit.urgent ? "Red Flag removida." : "Red Flag ativada.", visit.urgent ? "info" : "warn");
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
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Atendimento de ${visit.name}`}
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
                <h2>{visit.name}</h2>
                <small className="mono">CPF {visit.cpf}</small>
              </div>
              <button className="icon-btn" onClick={closeVisit} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>

            <div className="drawer-body">
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

              <fieldset className="field">
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
