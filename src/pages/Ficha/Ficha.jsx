import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Printer, TriangleAlert, UserRound, MessageSquareText, Pill, HeartPulse, ShieldAlert, StickyNote, History } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { STATUS } from "../../data/catalog";
import { RISK_LEVELS } from "../NovaTriagem/constants";
import { rise } from "../../utils/motion";
import "./Ficha.css";

const RISK = Object.fromEntries(RISK_LEVELS.map((r) => [r.id, r]));
const SEX = { F: "Feminino", M: "Masculino" };

// o servidor guarda só os dígitos; aqui volta ao formato de leitura
const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
function phone(v) {
  const d = onlyDigits(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || null;
}
const cns = (v) => onlyDigits(v).replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4") || null;

function brDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : null;
}

function age(iso) {
  if (!iso) return null;
  const b = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return Number.isFinite(a) ? a : null;
}

const dateTime = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const VITALS = [
  ["PA", (v) => (v.systolic != null && v.diastolic != null ? `${v.systolic}/${v.diastolic} mmHg` : null)],
  ["FC", (v) => (v.heartRate != null ? `${v.heartRate} bpm` : null)],
  ["SpO₂", (v) => (v.spo2 != null ? `${v.spo2}%` : null)],
  ["Temperatura", (v) => (v.temperature != null ? `${String(v.temperature).replace(".", ",")} °C` : null)],
  ["Peso", (v) => (v.weightKg != null ? `${String(v.weightKg).replace(".", ",")} kg` : null)],
  ["Altura", (v) => (v.heightCm != null ? `${v.heightCm} cm` : null)],
  ["IMC", (v) => (v.bmi != null ? String(v.bmi).replace(".", ",") : null)],
];

function List({ items }) {
  return items?.length ? <ul className="ficha-list">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <span className="muted">Nenhum registrado</span>;
}

/** Ficha completa de um atendimento da farmácia, com histórico e versão para imprimir. */
export default function Ficha() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    repository.getVisitRecord(id).then(
      (data) => setState({ status: "ready", data }),
      (err) => setState({ status: "error", error: err.message || "Não foi possível abrir a ficha." })
    );
  }, [id]);

  if (state.status !== "ready") {
    return (
      <main className="dash-content">
        <Link to="/" className="link-arrow ficha-back"><ArrowLeft size={14} /> Voltar</Link>
        {state.status === "loading" ? (
          <p className="muted">Carregando a ficha…</p>
        ) : (
          <div className="load-error" role="alert"><TriangleAlert size={18} /><span>{state.error}</span></div>
        )}
      </main>
    );
  }

  const { visit, record, history } = state.data;
  const p = record.patient ?? {};
  const risk = RISK[record.risk];
  const status = STATUS[visit.status];
  const vitals = VITALS.map(([label, fmt]) => [label, fmt(record.vitals ?? {})]).filter(([, v]) => v);
  const years = age(p.birthDate);

  return (
    <main className="dash-content ficha">
      <div className="ficha-top no-print">
        <Link to="/" className="link-arrow ficha-back"><ArrowLeft size={14} /> Voltar</Link>
        <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir / PDF
        </button>
      </div>

      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Ficha do atendimento</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>{p.name ?? visit.name}</motion.h1>
          <motion.p className="hello" {...rise(2)}>
            Protocolo <b className="mono">{visit.protocol ?? "—"}</b> · {dateTime(visit.at)} · RT {visit.rt || "—"}
          </motion.p>
        </div>
        <motion.div className="ficha-tags" {...rise(2)}>
          {status && <span className={`ficha-tag ficha-tag--${status.tone}`}>{status.short}</span>}
          {risk && <span className={`ficha-tag ficha-risk--${risk.id}`}>Risco {risk.label} · {risk.hint}</span>}
          {visit.urgent && <span className="ficha-tag ficha-tag--red"><TriangleAlert size={13} /> Red Flag</span>}
        </motion.div>
      </section>

      <div className="ficha-grid">
        <SpotlightCard index={2} className="ficha-card">
          <h2><UserRound size={17} /> Paciente</h2>
          <dl className="ficha-dl">
            <div><dt>CPF</dt><dd className="mono">{visit.cpf}</dd></div>
            {p.cns && <div><dt>CNS</dt><dd className="mono">{cns(p.cns)}</dd></div>}
            <div><dt>Nascimento</dt><dd>{brDate(p.birthDate) ?? "—"}{years != null && ` (${years} anos)`}</dd></div>
            <div><dt>Sexo</dt><dd>{SEX[p.sex] ?? "—"}</dd></div>
            <div><dt>Telefone</dt><dd>{phone(p.phone) ?? "—"}</dd></div>
          </dl>
        </SpotlightCard>

        <SpotlightCard index={3} className="ficha-card">
          <h2><MessageSquareText size={17} /> Queixa principal</h2>
          <p className="ficha-text">{record.complaint?.text ?? visit.complaint}</p>
          <dl className="ficha-dl">
            {record.complaint?.code && <div><dt>CID / CIAP</dt><dd>{record.complaint.code}</dd></div>}
            {record.complaint?.onset && <div><dt>Início</dt><dd>{brDate(record.complaint.onset)}</dd></div>}
          </dl>
        </SpotlightCard>

        <SpotlightCard index={4} className="ficha-card">
          <h2><Pill size={17} /> Histórico clínico</h2>
          <dl className="ficha-dl ficha-dl--stack">
            <div><dt>Alergias</dt><dd><List items={record.history?.allergies} /></dd></div>
            <div><dt>Comorbidades</dt><dd><List items={record.history?.comorbidities} /></dd></div>
            <div><dt>Medicamentos em uso</dt><dd><List items={record.history?.medications} /></dd></div>
          </dl>
        </SpotlightCard>

        <SpotlightCard index={5} className="ficha-card">
          <h2><HeartPulse size={17} /> Sinais vitais</h2>
          {vitals.length ? (
            <dl className="ficha-vitals">
              {vitals.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          ) : (
            <span className="muted">Não registrados</span>
          )}
        </SpotlightCard>

        <SpotlightCard index={6} className="ficha-card">
          <h2><ShieldAlert size={17} /> Classificação e alertas</h2>
          <dl className="ficha-dl ficha-dl--stack">
            <div><dt>Classificação de risco</dt><dd>{risk ? `${risk.label} — ${risk.hint}` : "—"}</dd></div>
            <div><dt>Sinais de alerta (Red Flags)</dt><dd><List items={record.redFlags} /></dd></div>
          </dl>
        </SpotlightCard>

        <SpotlightCard index={7} className="ficha-card">
          <h2><StickyNote size={17} /> Observações</h2>
          <p className="ficha-text">{record.notes || <span className="muted">Sem observações</span>}</p>
        </SpotlightCard>
      </div>

      <SpotlightCard index={8} className="ficha-card">
        <h2><History size={17} /> Histórico do atendimento</h2>
        <ol className="ficha-timeline">
          {history.map((h, i) => (
            <li key={`${h.at}-${i}`}>
              <time className="mono">{dateTime(h.at)}</time>
              <div>
                <strong>{h.label}</strong>
                <small>por {h.actor}</small>
              </div>
            </li>
          ))}
        </ol>
      </SpotlightCard>
    </main>
  );
}
