import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, TriangleAlert, Download, FileText, AlertCircle, UserX, PencilLine, Inbox } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { useClinic } from "../../contexts/clinic";
import { maskCpf, isValidCpf } from "../../utils/cpf";
import { downloadJson, datedName } from "../../utils/download";
import { rise } from "../../utils/motion";
import "./PedidosLgpd.css";

const TYPES = {
  correcao: { label: "Correção de dados", icon: PencilLine },
  exclusao: { label: "Exclusão da conta", icon: UserX },
};
const STATUS = {
  aberto: { label: "Em análise", tone: "amber" },
  concluido: { label: "Concluído", tone: "green" },
  recusado: { label: "Recusado", tone: "red" },
};
const FILTERS = [
  { value: "aberto", label: "Em análise" },
  { value: "", label: "Todos" },
];
const when = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Administração: pedidos dos titulares (LGPD, art. 18). Usuários pedem em "Minha conta";
 * pacientes pedem na farmácia ou ao Sincofarma, e a exportação sai daqui pelo CPF.
 */
export default function PedidosLgpd() {
  const { notify } = useClinic();
  const [filter, setFilter] = useState("aberto");
  const [state, setState] = useState({ status: "loading", items: [] });

  const load = useCallback((f) => {
    repository.listPrivacyRequests(f || undefined).then(
      (items) => setState({ status: "ready", items }),
      (err) => setState({ status: "error", items: [], error: err.message || "Não foi possível carregar os pedidos." })
    );
  }, []);
  useEffect(() => load(filter), [load, filter]);

  function changeFilter(f) {
    setState((s) => ({ ...s, status: "loading" }));
    setFilter(f);
  }

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Gestão</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Privacidade (LGPD)</motion.h1>
          <motion.p className="hello" {...rise(2)}>Pedidos de quem usa o painel e cópia dos dados de pacientes.</motion.p>
        </div>
      </section>

      <motion.div className="data-hidden audit-note" role="note" {...rise(3)}>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          A LGPD dá 15 dias para responder um pedido de acesso (art. 19). Tudo o que é feito aqui fica no registro de
          auditoria. <Link to="/privacidade">Ver a política de privacidade</Link>.
        </span>
      </motion.div>

      <div className="lgpd-admin-grid">
        <SpotlightCard index={4} className="lgpd-admin-card">
          <header className="card-head">
            <div>
              <h2>Pedidos dos usuários</h2>
              <p>Correção de dados e exclusão de conta, feitos em "Minha conta".</p>
            </div>
            <div className="lgpd-tabs" role="tablist" aria-label="Filtrar pedidos">
              {FILTERS.map((f) => (
                <button
                  key={f.value || "todos"}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  className={filter === f.value ? "is-on" : ""}
                  onClick={() => changeFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </header>

          {state.status === "error" && (
            <div className="load-error" role="alert">
              <TriangleAlert size={18} />
              <span>{state.error}</span>
              <button type="button" className="btn btn--ghost" onClick={() => changeFilter(filter)}>Tentar de novo</button>
            </div>
          )}
          {state.status === "loading" && <p className="lgpd-empty">Carregando…</p>}
          {state.status === "ready" && state.items.length === 0 && (
            <p className="lgpd-empty"><Inbox size={18} aria-hidden="true" /> {filter ? "Nenhum pedido em análise." : "Nenhum pedido ainda."}</p>
          )}
          <ul className="lgpd-list">
            {state.items.map((r) => (
              <RequestItem key={r.id} request={r} notify={notify} onAnswered={() => load(filter)} />
            ))}
          </ul>
        </SpotlightCard>

        <PatientExport notify={notify} />
      </div>
    </main>
  );
}

function RequestItem({ request: r, notify, onAnswered }) {
  const [answer, setAnswer] = useState(null); // "concluido" | "recusado" | null
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const type = TYPES[r.type] ?? { label: r.type, icon: FileText };
  const Icon = type.icon;
  const anonimiza = r.type === "exclusao" && answer === "concluido";

  async function send(e) {
    e.preventDefault();
    if (text.trim().length < 3) return setError("Escreva a resposta ao titular.");
    setError("");
    setBusy(true);
    try {
      await repository.answerPrivacyRequest(r.id, { status: answer, response: text.trim() });
      notify(anonimiza ? "Conta anonimizada e pedido concluído." : "Pedido respondido.", "success");
      onAnswered();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <li className="lgpd-item">
      <div className="lgpd-item-head">
        <span className={`lgpd-item-icon${r.type === "exclusao" ? " is-danger" : ""}`}><Icon size={16} aria-hidden="true" /></span>
        <div className="lgpd-item-text">
          <strong>{type.label}</strong>
          <small>{r.subject?.name ?? "—"} · {when(r.at)}</small>
        </div>
        <span className={`lgpd-status lgpd-status--${STATUS[r.status]?.tone ?? "amber"}`}>{STATUS[r.status]?.label ?? r.status}</span>
      </div>
      {r.details && <p className="lgpd-item-details">“{r.details}”</p>}
      {r.response && <p className="lgpd-item-response"><b>Resposta:</b> {r.response}</p>}

      {r.status === "aberto" && !answer && (
        <div className="lgpd-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setAnswer("recusado")}>Recusar</button>
          <button type="button" className={`btn ${r.type === "exclusao" ? "btn--danger-solid" : "btn--primary"}`} onClick={() => setAnswer("concluido")}>
            {r.type === "exclusao" ? "Anonimizar conta" : "Marcar como corrigido"}
          </button>
        </div>
      )}

      {answer && (
        <form className="lgpd-answer" onSubmit={send} noValidate>
          {anonimiza && (
            <p className="lgpd-warn" role="note">
              <TriangleAlert size={15} aria-hidden="true" />
              <span>
                Não tem volta: a conta sai do login (nome, e-mail, CPF, CRF, app autenticador) e a pessoa perde o acesso.
                Os atendimentos e a auditoria continuam, ligados ao código interno.
              </span>
            </p>
          )}
          {r.type === "correcao" && answer === "concluido" && (
            <p className="lgpd-hint">Corrija primeiro em Usuários (ou no Cognito, para nome e e-mail) e depois confirme aqui.</p>
          )}
          <label className="field">
            <span>RESPOSTA AO TITULAR</span>
            <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={answer === "recusado" ? "Explique o motivo da recusa" : "Ex.: e-mail atualizado conforme pedido"} />
          </label>
          {error && <p className="lgpd-error" role="alert"><AlertCircle size={14} /> {error}</p>}
          <div className="lgpd-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setAnswer(null)} disabled={busy}>Voltar</button>
            <button type="submit" className={`btn ${anonimiza ? "btn--danger-solid" : "btn--primary"}`} disabled={busy}>
              {busy ? "Enviando…" : anonimiza ? "Confirmar anonimização" : answer === "recusado" ? "Recusar pedido" : "Concluir pedido"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function PatientExport({ notify }) {
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState(null);

  async function run(e) {
    e.preventDefault();
    if (!isValidCpf(cpf)) return setError("CPF inválido.");
    setError("");
    setBusy(true);
    try {
      const data = await repository.exportPatient(cpf);
      downloadJson(datedName(`sincofarma-paciente-${cpf.replace(/\D/g, "").slice(-2)}`), data);
      setLast({ atendimentos: data.atendimentos.length, encaminhamentos: data.encaminhamentos.length, cpf: data.cpf });
      setCpf("");
      notify("Arquivo do paciente baixado.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SpotlightCard index={5} className="lgpd-admin-card">
      <header className="card-head">
        <div>
          <h2>Pedido de paciente</h2>
          <p>Cópia de todos os atendimentos e encaminhamentos de uma pessoa, a partir do CPF.</p>
        </div>
      </header>
      <ol className="lgpd-steps">
        <li>Confira um documento com foto do paciente (ou de quem o representa).</li>
        <li>Digite o CPF e baixe o arquivo.</li>
        <li>Entregue o arquivo ao paciente por um meio seguro.</li>
      </ol>
      <form className="lgpd-form" onSubmit={run} noValidate>
        <label className="field">
          <span>CPF DO PACIENTE</span>
          <input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf}
            onChange={(e) => setCpf(maskCpf(e.target.value))} />
        </label>
        {error && <p className="lgpd-error" role="alert"><AlertCircle size={14} /> {error}</p>}
        <div className="lgpd-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            <Download size={16} /> {busy ? "Buscando…" : "Baixar dados do paciente"}
          </button>
        </div>
      </form>
      {last && (
        <p className="lgpd-last" role="status">
          Último arquivo: CPF {last.cpf}, {last.atendimentos} {last.atendimentos === 1 ? "atendimento" : "atendimentos"} e{" "}
          {last.encaminhamentos} {last.encaminhamentos === 1 ? "encaminhamento" : "encaminhamentos"}.
        </p>
      )}
    </SpotlightCard>
  );
}
