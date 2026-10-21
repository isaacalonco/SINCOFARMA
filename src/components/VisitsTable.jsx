import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListFilter,
  ChevronDown,
  ArrowRight,
  Check,
  TriangleAlert,
  FileText,
  SquareArrowOutUpRight,
  FilePenLine,
  SearchX,
  X,
} from "lucide-react";
import { STATUS } from "../pages/Dashboard/data";
import { useClinic, matchesQuery } from "../contexts/clinic";
import SpotlightCard from "./SpotlightCard";
import { initials } from "../utils/initials";

const FILTERS = [
  { key: "all", label: "Todos os Desfechos" },
  { key: "done", label: STATUS.done.label },
  { key: "referred", label: STATUS.referred.label },
  { key: "progress", label: STATUS.progress.label },
];

const ACTIONS = {
  done: { icon: FileText, label: "Ver prontuário" },
  referred: { icon: SquareArrowOutUpRight, label: "Ver encaminhamento" },
  progress: { icon: FilePenLine, label: "Continuar triagem" },
};

export default function VisitsTable({
  title = "Últimos Atendimentos Farmacêuticos",
  subtitle = "Registros recentes de acolhimento clínico na Unidade Asa Sul",
  limit,
  lockedFilter,
  showViewAll = false,
  delay = 6,
}) {
  const { visits, query, setQuery, openVisit } = useClinic();
  const [filter, setFilter] = useState(lockedFilter ?? "all");
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = visits
    .filter((v) => filter === "all" || v.status === filter)
    .filter((v) => matchesQuery(v, query));
  const visible = limit && !query ? filtered.slice(0, limit) : filtered;
  const currentLabel = FILTERS.find((f) => f.key === filter).label;

  return (
    <SpotlightCard index={delay} className="table-card">
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="table-tools">
          {!lockedFilter && (
            <div className="dropdown" ref={menuRef}>
              <button
                className={`btn-filter${open ? " is-open" : ""}${filter !== "all" ? " is-filtered" : ""}`}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
              >
                <ListFilter size={14} />
                <span>{currentLabel}</span>
                <ChevronDown size={14} className="chev" />
              </button>
              <ul className={`dropdown-menu${open ? " is-open" : ""}`} role="listbox">
                {FILTERS.map((f) => (
                  <li key={f.key}>
                    <button
                      role="option"
                      aria-selected={filter === f.key}
                      className={filter === f.key ? "is-selected" : ""}
                      onClick={() => {
                        setFilter(f.key);
                        setOpen(false);
                      }}
                    >
                      {f.label}
                      {filter === f.key && <Check size={14} />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showViewAll && (
            <Link to="/atendimentos" className="link-arrow">
              Ver todos ({visits.length}) <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </header>

      <AnimatePresence initial={false}>
        {query && (
          <motion.div
            className="search-hint"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="search-hint-inner">
              <span>
                <b>{filtered.length}</b> {filtered.length === 1 ? "resultado" : "resultados"} para
                “{query}”
              </span>
              <button onClick={() => setQuery("")}>
                <X size={12} /> Limpar busca
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="table-scroll">
        <table className="visits">
          <thead>
            <tr>
              <th>PACIENTE / IDENTIFICADOR</th>
              <th>QUEIXA PRINCIPAL &amp; SINAIS</th>
              <th>HORÁRIO</th>
              <th>RT RESPONSÁVEL</th>
              <th className="ta-right">STATUS / DESFECHO</th>
              <th className="ta-center">AÇÃO</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((r) => {
                const status = STATUS[r.status];
                const action = ACTIONS[r.status];
                const ActionIcon = action.icon;
                const tone = r.urgent ? "red" : status.tone;
                return (
                  <motion.tr
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={`visit-row${r.urgent ? " is-urgent" : ""}`}
                    onClick={() => openVisit(r.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openVisit(r.id)}
                  >
                    <td>
                      <div className="patient">
                        <span className={`avatar avatar--${tone}`}>{initials(r.name)}</span>
                        <div>
                          <strong>
                            {r.name}
                            {r.urgent && (
                              <TriangleAlert size={14} className="urgent-icon" aria-label="Urgente" />
                            )}
                            {r.source === "RNDS" && <span className="tag-rnds">RNDS</span>}
                          </strong>
                          <small className="mono">CPF {r.cpf}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="complaint">
                        <strong>{r.complaint}</strong>
                        <small>{r.signs || "—"}</small>
                      </div>
                    </td>
                    <td className="mono">{r.time}</td>
                    <td>{r.rt}</td>
                    <td className="ta-right">
                      <motion.span
                        key={r.status}
                        className={`status status--${status.tone}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      >
                        <i />
                        {status.label}
                      </motion.span>
                    </td>
                    <td className="ta-center">
                      <button
                        className={`icon-btn${r.urgent ? " icon-btn--red" : ""}`}
                        aria-label={`${action.label}: ${r.name}`}
                        title={action.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          openVisit(r.id);
                        }}
                      >
                        <ActionIcon size={16} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  <SearchX size={20} />
                  <span>
                    {query
                      ? "Nenhum atendimento encontrado para essa busca."
                      : "Nenhum atendimento com esse desfecho."}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {limit && !query && filtered.length > limit && (
        <div className="table-more">
          Mostrando {limit} de {filtered.length} ·{" "}
          <Link to="/atendimentos" className="link-arrow">
            ver lista completa <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </SpotlightCard>
  );
}
