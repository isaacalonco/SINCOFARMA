import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListFilter,
  ArrowRight,
  TriangleAlert,
  FileText,
  SquareArrowOutUpRight,
  FilePenLine,
  SearchX,
  X,
} from "lucide-react";
import { STATUS } from "../data/catalog";
import { useClinic, useSearch, matchesQuery } from "../contexts/clinic";
import SpotlightCard from "./SpotlightCard";
import Select from "./Select";
import { isReady } from "../config/app";
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
  subtitle = "Registros recentes de acolhimento clínico na unidade",
  limit,
  lockedFilter,
  showViewAll = false,
  delay = 6,
}) {
  const { visits, openVisit } = useClinic();
  const { query, setQuery } = useSearch();
  const [filter, setFilter] = useState(lockedFilter ?? "all");
  const [expanded, setExpanded] = useState(false);
  const listPage = isReady("/atendimentos");

  const filtered = visits
    .filter((v) => filter === "all" || v.status === filter)
    .filter((v) => matchesQuery(v, query));
  const cut = limit && !query && !expanded;
  const visible = cut ? filtered.slice(0, limit) : filtered;

  return (
    <SpotlightCard index={delay} className="table-card">
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="table-tools">
          {!lockedFilter && (
            <Select
              className={`btn-filter${filter !== "all" ? " is-filtered" : ""}`}
              icon={ListFilter}
              label="Filtrar por desfecho"
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ value: f.key, label: f.label }))}
            />
          )}
          {showViewAll &&
            (listPage ? (
              <Link to="/atendimentos" className="link-arrow">
                Ver todos ({visits.length}) <ArrowRight size={14} />
              </Link>
            ) : (
              limit && filtered.length > limit && !query && (
                <button type="button" className="link-arrow link-btn" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                  {expanded ? "Mostrar menos" : `Ver todos (${filtered.length})`}
                  <ArrowRight size={14} className={expanded ? "rot-up" : "rot-down"} />
                </button>
              )
            ))}
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
            <AnimatePresence initial={false}>
              {visible.map((r) => {
                const status = STATUS[r.status];
                const action = ACTIONS[r.status];
                const ActionIcon = action.icon;
                const tone = r.urgent ? "red" : status.tone;
                return (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={`visit-row${r.urgent ? " is-urgent" : ""}`}
                    onClick={() => openVisit(r.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Abrir atendimento de ${r.name}${r.urgent ? ", urgente" : ""}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openVisit(r.id);
                      }
                    }}
                  >
                    <td>
                      <div className="patient">
                        <span className={`avatar avatar--${tone}`}>{initials(r.name)}</span>
                        <div>
                          <strong>
                            {r.name}
                            {r.urgent && (
                              <>
                                <TriangleAlert size={14} className="urgent-icon" aria-hidden="true" />
                                <span className="sr-only">Urgente</span>
                              </>
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

      {cut && filtered.length > limit && (
        <div className="table-more">
          Mostrando {limit} de {filtered.length} ·{" "}
          {listPage ? (
            <Link to="/atendimentos" className="link-arrow">
              ver lista completa <ArrowRight size={14} />
            </Link>
          ) : (
            <button type="button" className="link-arrow link-btn" onClick={() => setExpanded(true)}>
              mostrar todos <ArrowRight size={14} className="rot-down" />
            </button>
          )}
        </div>
      )}
    </SpotlightCard>
  );
}
