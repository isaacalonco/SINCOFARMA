import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TriangleAlert, ListFilter, Store, ShieldCheck, CalendarDays } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import Select from "../../components/Select";
import { repository } from "../../data";
import { PAPEIS } from "../../services/permissoes";
import { STATUS } from "../../data/catalog";
import { rise } from "../../utils/motion";
import "./Auditoria.css";

// ação -> rótulo e grupo (para o filtro)
const ACTIONS = {
  visit_create: { label: "Registrou atendimento", group: "atendimentos" },
  visit_update: { label: "Alterou desfecho / Red Flag", group: "atendimentos" },
  referral_create: { label: "Encaminhou a médico", group: "encaminhamentos" },
  referral_read: { label: "Leu encaminhamento", group: "encaminhamentos" },
  referral_answered: { label: "Respondeu encaminhamento", group: "encaminhamentos" },
  referral_declined: { label: "Recusou encaminhamento", group: "encaminhamentos" },
  referral_cancelled: { label: "Cancelou encaminhamento", group: "encaminhamentos" },
  user_create: { label: "Cadastrou usuário", group: "usuarios" },
  user_update: { label: "Alterou usuário", group: "usuarios" },
  // acesso à ficha completa (CPF, telefone, dados de saúde)
  visit_read: { label: "Abriu ficha", group: "atendimentos" },
  lgpd_export_self: { label: "Baixou os próprios dados", group: "privacidade" },
  lgpd_request: { label: "Pedido de privacidade", group: "privacidade" },
  lgpd_request_resolved: { label: "Respondeu pedido de privacidade", group: "privacidade" },
  lgpd_user_anonymized: { label: "Anonimizou conta", group: "privacidade" },
  lgpd_export_patient: { label: "Exportou dados de paciente", group: "privacidade" },
};
const GROUPS = { atendimentos: "Atendimentos", encaminhamentos: "Encaminhamentos", usuarios: "Usuários e acessos", privacidade: "Privacidade (LGPD)" };

const thisMonth = () => new Date().toISOString().slice(0, 7);
// últimos 12 meses, do mais recente para o mais antigo
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { value, label: label[0].toUpperCase() + label.slice(1) };
});
const when = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Detalhe legível do que mudou, sem dado de paciente (o servidor nem manda). */
function detail(ev) {
  const d = ev.details ?? {};
  const t = ev.target ?? {};
  const parts = [];
  if (t.type === "visit" || t.type === "referral") parts.push(`Protocolo ${t.label ?? "—"}`);
  if (t.type === "referral" && t.doctor) parts.push(`médico: ${t.doctor}`);
  if (t.type === "user") parts.push(t.label ?? "conta removida");
  if (t.type === "lgpd_request") parts.push(t.label);
  // paciente: só o CPF mascarado e quantos registros saíram no arquivo
  if (t.type === "patient") parts.push(`CPF ${t.label}`);
  if (d.atendimentos !== undefined) parts.push(`${d.atendimentos} atendimento(s), ${d.encaminhamentos} encaminhamento(s)`);
  if (d.status === "concluido" || d.status === "recusado") parts.push(d.status === "concluido" ? "concluído" : "recusado");
  if (Array.isArray(d.status) && STATUS[d.status[1]]) parts.push(`${STATUS[d.status[0]]?.short ?? d.status[0]} → ${STATUS[d.status[1]].short}`);
  if (Array.isArray(d.urgent) && d.urgent[0] !== d.urgent[1]) parts.push(d.urgent[1] ? "Red Flag ligada" : "Red Flag desligada");
  if (d.roles) parts.push(`perfil: ${d.roles.map((r) => PAPEIS[r] ?? r).join(" + ")}`);
  if ("unit" in d) parts.push(d.unit ? `farmácia: ${d.unit}` : "sem farmácia");
  if (d.enabled === false) parts.push("desativado");
  if (d.enabled === true) parts.push("reativado");
  if (d.resetMfa) parts.push("MFA resetado");
  if (d.resendInvite) parts.push("convite reenviado");
  if (d.priority) parts.push(`prioridade ${d.priority}`);
  return parts.filter(Boolean).join(" · ");
}

/** Administração: quem fez o quê, onde e quando. Sem nenhum dado de paciente. */
export default function Auditoria() {
  const [month, setMonth] = useState(thisMonth);
  const [state, setState] = useState({ status: "loading", events: [], next: null, units: [] });
  const [group, setGroup] = useState("all");
  const [unit, setUnit] = useState("all");

  // estado só muda quando a resposta chega (nada síncrono dentro do efeito)
  const fetchPage = useCallback((m, start) => {
    repository.listAudit(m, start).then(
      (res) =>
        setState((s) => ({
          status: "ready",
          events: start ? [...s.events, ...res.events] : res.events,
          next: res.next,
          units: res.units,
        })),
      (err) => setState((s) => ({ ...s, status: "error", error: err.message || "Não foi possível carregar a auditoria." }))
    );
  }, []);
  useEffect(() => fetchPage(month), [fetchPage, month]);

  function changeMonth(value) {
    if (!value) return;
    setState((s) => ({ ...s, status: "loading", events: [] }));
    setMonth(value);
  }

  const unitName = useMemo(() => Object.fromEntries(state.units.map((u) => [u.id, u.name])), [state.units]);
  const events = state.events.filter(
    (e) => (group === "all" || ACTIONS[e.action]?.group === group) && (unit === "all" || e.unit === unit)
  );

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Gestão</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Auditoria</motion.h1>
          <motion.p className="hello" {...rise(2)}>Quem fez o quê, em qual farmácia e quando.</motion.p>
        </div>
      </section>

      <motion.div className="data-hidden audit-note" role="note" {...rise(3)}>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          Este registro não guarda dados de pacientes: atendimentos aparecem pelo protocolo. Os detalhes clínicos
          ficam na ficha, visível só para a farmácia do atendimento.
        </span>
      </motion.div>

      {state.status === "error" && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{state.error}</span>
          <button type="button" className="btn btn--ghost" onClick={() => changeMonth(month)}>Tentar de novo</button>
        </div>
      )}

      <SpotlightCard index={4} className="table-card">
        <header className="card-head">
          <div>
            <h2>Registro de {new Date(`${month}-15`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
            <p>{state.status === "loading" ? "Carregando…" : `${events.length} ${events.length === 1 ? "evento" : "eventos"}`}</p>
          </div>
          <div className="table-tools">
            <Select className="btn-filter" icon={CalendarDays} label="Mês" value={month} onChange={changeMonth} options={MONTHS} />
            <Select
              className={`btn-filter${group !== "all" ? " is-filtered" : ""}`}
              icon={ListFilter}
              label="Tipo de ação"
              value={group}
              onChange={setGroup}
              options={[{ value: "all", label: "Todas as ações" }, ...Object.entries(GROUPS).map(([k, l]) => ({ value: k, label: l }))]}
            />
            <Select
              className={`btn-filter${unit !== "all" ? " is-filtered" : ""}`}
              icon={Store}
              label="Farmácia"
              value={unit}
              onChange={setUnit}
              options={[{ value: "all", label: "Todas as farmácias" }, ...state.units.map((u) => ({ value: u.id, label: u.name }))]}
            />
          </div>
        </header>

        <div className="table-scroll">
          <table className="visits audit-table">
            <thead>
              <tr>
                <th>QUANDO</th>
                <th>QUEM</th>
                <th>AÇÃO</th>
                <th>FARMÁCIA</th>
                <th>DETALHE</th>
              </tr>
            </thead>
            <tbody>
              {state.status === "ready" && events.length === 0 && (
                <tr><td colSpan={5} className="empty">Nenhum evento neste mês com esses filtros.</td></tr>
              )}
              {events.map((e) => (
                <tr key={e.SK}>
                  <td className="mono">{when(e.at)}</td>
                  <td>
                    <strong className="audit-who">{e.actorName}</strong>
                    <small className="muted">{(e.actorRoles ?? []).map((r) => PAPEIS[r] ?? r).join(" + ")}</small>
                  </td>
                  <td><span className={`audit-action audit-action--${ACTIONS[e.action]?.group ?? "outros"}`}>{ACTIONS[e.action]?.label ?? e.action}</span></td>
                  <td>{e.unit ? unitName[e.unit] ?? e.unit : <span className="muted">—</span>}</td>
                  <td className="audit-detail">{detail(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.next && (
          <div className="table-more">
            <button type="button" className="link-arrow link-btn" onClick={() => fetchPage(month, state.next)}>
              Carregar mais
            </button>
          </div>
        )}
      </SpotlightCard>
    </main>
  );
}
