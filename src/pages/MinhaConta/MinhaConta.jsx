import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound, Smartphone, LogOut, Mail, Building2, BadgeCheck, ShieldCheck,
  Check, AlertCircle, ChevronDown, Lock, Download, PencilLine, UserX, FileText,
} from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import { account } from "../../services/authService";
import { repository } from "../../data";
import { downloadJson, datedName } from "../../utils/download";
import { totpUri } from "../../services/cognito";
import { PAPEIS } from "../../services/permissoes";
import { DEMO_MODE } from "../../config/app";
import { initials } from "../../utils/initials";
import { rise, EASE } from "../../utils/motion";
import "./MinhaConta.css";

const ROLE_TONE = { farmaceutico: "green", medico: "blue", admin: "purple" };

// regras da senha, mostradas uma a uma enquanto a pessoa digita
const RULES = [
  { id: "len", label: "12 caracteres ou mais", test: (s) => s.length >= 12 },
  { id: "upper", label: "Uma letra maiúscula", test: (s) => /[A-Z]/.test(s) },
  { id: "lower", label: "Uma letra minúscula", test: (s) => /[a-z]/.test(s) },
  { id: "digit", label: "Um número", test: (s) => /\d/.test(s) },
];

/** A própria conta: dados, senha, app autenticador e sessões abertas. */
export default function MinhaConta() {
  const { user, signOut } = useAuth();
  const { unit, notify } = useClinic();
  const [email, setEmail] = useState(null);
  // uma linha aberta por vez, nos dois cartões: password | totp | sessions | export | correcao | exclusao
  const [open, setOpen] = useState(null);

  useEffect(() => {
    account.details().then((d) => setEmail(d.email ?? null), () => {});
  }, []);

  const toggle = (key) => setOpen((o) => (o === key ? null : key));
  const roles = user?.roles ?? [];
  const tone = ROLE_TONE[roles[0]] ?? "none";

  return (
    <main className="dash-content account-page">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Minha conta</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Minha conta</motion.h1>
          <motion.p className="hello" {...rise(2)}>Sua senha, seu app autenticador e onde você está conectado.</motion.p>
        </div>
      </section>

      {DEMO_MODE && (
        <div className="data-hidden" role="note">
          <AlertCircle size={18} aria-hidden="true" />
          <span>Na demonstração não há conta real: as ações desta página ficam desligadas.</span>
        </div>
      )}

      <div className="account-grid">
        <SpotlightCard index={2} className={`account-profile account-profile--${tone}`}>
          <div className="account-cover" aria-hidden="true" />
          <div className="account-identity">
            <span className="account-avatar">{initials(user?.name) || "RT"}</span>
            <div className="account-who">
              <h2>{user?.name}</h2>
              <div className="role-chips">
                {roles.map((r) => (
                  <span key={r} className={`role-chip role-chip--${ROLE_TONE[r] ?? "none"}`}>{PAPEIS[r] ?? r}</span>
                ))}
              </div>
            </div>
          </div>

          <ul className="account-meta">
            <Meta icon={Mail} label="E-mail" value={email ?? "—"} />
            {user?.unit && <Meta icon={Building2} label="Farmácia" value={unit || user.unit} />}
            {user?.crf && <Meta icon={BadgeCheck} label="Registro" value={user.crf} />}
          </ul>

          <div className="account-shield">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Conta protegida em duas etapas</strong>
              <small>Senha + código do app autenticador a cada entrada.</small>
            </div>
          </div>

          <p className="account-note">
            <Lock size={12} aria-hidden="true" />
            Nome, e-mail, perfil e farmácia são alterados pela administração do Sincofarma.
          </p>
        </SpotlightCard>

        <div className="account-col">
        <SpotlightCard index={3} className="account-security">
          <header className="card-head">
            <div>
              <h2>Segurança</h2>
              <p>Tudo o que protege o seu acesso ao painel.</p>
            </div>
          </header>

          <Row
            icon={KeyRound} title="Senha" text="Troque quando quiser. A nova senha vale na próxima entrada."
            open={open === "password"} onToggle={() => toggle("password")}
          >
            <PasswordForm notify={notify} onDone={() => setOpen(null)} />
          </Row>

          <Row
            icon={Smartphone} title="App autenticador" text="Trocou de celular? Cadastre o app no aparelho novo."
            open={open === "totp"} onToggle={() => toggle("totp")}
          >
            <TotpForm notify={notify} user={user} onDone={() => setOpen(null)} />
          </Row>

          <Row
            icon={LogOut} title="Sessões abertas" text="Encerre o painel em todos os aparelhos, inclusive neste."
            open={open === "sessions"} onToggle={() => toggle("sessions")} danger
          >
            <SessionsForm signOut={signOut} notify={notify} />
          </Row>
        </SpotlightCard>

        <PrivacyCard open={open} toggle={toggle} close={() => setOpen(null)} notify={notify} />
        </div>
      </div>
    </main>
  );
}

function Meta({ icon: Icon, label, value }) {
  return (
    <li>
      <span className="account-meta-icon"><Icon size={15} aria-hidden="true" /></span>
      <span className="account-meta-text">
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </li>
  );
}

/** Linha de segurança: ícone, título e descrição; o conteúdo abre embaixo. */
function Row({ icon: Icon, title, text, open, onToggle, danger, children }) {
  return (
    <div className={`sec-row${open ? " is-open" : ""}${danger ? " sec-row--danger" : ""}`}>
      <button type="button" className="sec-head" onClick={onToggle} aria-expanded={open}>
        <span className="sec-icon"><Icon size={17} aria-hidden="true" /></span>
        <span className="sec-text">
          <strong>{title}</strong>
          <small>{text}</small>
        </span>
        <ChevronDown size={18} className="sec-chev" aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="sec-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: EASE }}
          >
            <div className="sec-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PasswordForm({ notify, onDone }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const passed = RULES.filter((r) => r.test(form.next)).length;
  const strong = passed === RULES.length;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.current) return setError("Digite a senha atual.");
    if (!strong) return setError("A nova senha ainda não cumpre todas as regras.");
    if (form.next !== form.confirm) return setError("As senhas novas não conferem.");
    setBusy(true);
    try {
      await account.changePassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      notify("Senha alterada.", "success");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="account-form" onSubmit={submit} noValidate>
      <label className="field">
        <span>SENHA ATUAL</span>
        <input type="password" autoComplete="current-password" value={form.current} onChange={set("current")} />
      </label>
      <div className="account-form-pair">
        <label className="field">
          <span>NOVA SENHA</span>
          <input type="password" autoComplete="new-password" value={form.next} onChange={set("next")} />
        </label>
        <label className="field">
          <span>CONFIRME A NOVA SENHA</span>
          <input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        </label>
      </div>

      <div className="pw-meter" aria-live="polite">
        <div className={`pw-bar pw-bar--${passed}`}>
          {RULES.map((r) => <i key={r.id} />)}
        </div>
        <ul className="pw-rules">
          {RULES.map((r) => {
            const ok = r.test(form.next);
            return (
              <li key={r.id} className={ok ? "is-ok" : ""}>
                <span className="pw-dot">{ok && <Check size={10} strokeWidth={3} />}</span>
                {r.label}
              </li>
            );
          })}
        </ul>
      </div>

      {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
      <div className="account-actions">
        <button type="submit" className="btn btn--primary" disabled={busy || DEMO_MODE}>
          {busy ? "Salvando…" : "Trocar senha"}
        </button>
      </div>
    </form>
  );
}

function TotpForm({ notify, user, onDone }) {
  const [setup, setSetup] = useState(null); // { secret, qr }
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const secret = await account.startTotpChange();
      const QRCode = await import("qrcode");
      // rótulo no app: só o primeiro nome (sem documento no celular)
      const label = String(user?.name ?? "conta").replace(/^Dra?\.\s*/, "").split(" ")[0];
      const qr = await QRCode.toDataURL(totpUri(secret, label), { margin: 1, width: 168 });
      setSetup({ secret, qr });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Digite os 6 números do app.");
    setError("");
    setBusy(true);
    try {
      await account.finishTotpChange(code);
      setSetup(null);
      setCode("");
      notify("Novo app autenticador ativado. O antigo deixou de valer.", "success");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!setup) {
    return (
      <div className="account-form">
        <p className="account-text">
          Ao ativar o app no celular novo, o código do aparelho antigo deixa de funcionar na hora.
          Tenha o celular novo em mãos antes de começar.
        </p>
        {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
        <div className="account-actions">
          <button type="button" className="btn btn--primary" onClick={start} disabled={busy || DEMO_MODE}>
            {busy ? "Gerando…" : "Trocar de celular"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="account-form" onSubmit={finish} noValidate>
      <div className="totp-setup">
        <div className="totp-qr">
          <img src={setup.qr} alt="QR code para o app autenticador" width={168} height={168} />
        </div>
        <ol className="totp-steps">
          <li>Abra o app autenticador no celular novo.</li>
          <li>Leia o QR code ao lado.</li>
          <li>Digite abaixo o código de 6 números que aparecer.</li>
        </ol>
      </div>
      <small className="account-hint">Sem câmera? Chave: <code>{setup.secret.match(/.{1,4}/g).join(" ")}</code></small>
      <label className="field field--code">
        <span>CÓDIGO DO APP</span>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </label>
      {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
      <div className="account-actions">
        <button type="button" className="btn btn--ghost" onClick={() => setSetup(null)}>Cancelar</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Conferindo…" : "Ativar app novo"}</button>
      </div>
    </form>
  );
}

function SessionsForm({ signOut, notify }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function everywhere() {
    setBusy(true);
    try {
      await account.signOutEverywhere();
      signOut();
    } catch (err) {
      notify(err.message, "error");
      setBusy(false);
    }
  }

  return (
    <div className="account-form">
      <p className="account-text">
        Esqueceu o painel aberto em outro computador? Isso encerra a sessão em todos os aparelhos,
        inclusive neste. Você precisará entrar de novo.
      </p>
      <div className="account-actions">
        {confirm ? (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)}>Voltar</button>
            <button type="button" className="btn btn--danger-solid" onClick={everywhere} disabled={busy}>
              {busy ? "Encerrando…" : <><Check size={14} /> Sair de todos</>}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => setConfirm(true)} disabled={DEMO_MODE}>
            Sair de todos os aparelhos
          </button>
        )}
      </div>
    </div>
  );
}

const REQUEST_TYPES = { correcao: "Correção de dados", exclusao: "Exclusão da conta" };
const REQUEST_STATUS = {
  aberto: { label: "Em análise", tone: "amber" },
  concluido: { label: "Concluído", tone: "green" },
  recusado: { label: "Recusado", tone: "red" },
};
const day = (iso) => new Date(iso).toLocaleDateString("pt-BR");

/** LGPD, art. 18: baixar os próprios dados e pedir correção ou exclusão da conta. */
function PrivacyCard({ open, toggle, close, notify }) {
  const [requests, setRequests] = useState([]);
  const load = useCallback(() => {
    repository.listMyRequests().then(setRequests, () => {});
  }, []);
  useEffect(load, [load]);

  const done = (msg) => {
    notify(msg, "success");
    close();
    load();
  };

  return (
    <SpotlightCard index={4} className="account-security">
      <header className="card-head">
        <div>
          <h2>Privacidade e seus dados</h2>
          <p>Seus direitos pela LGPD: ver tudo o que o painel guarda sobre você, corrigir ou pedir a exclusão.</p>
        </div>
      </header>

      <Row
        icon={Download} title="Baixar meus dados" text="Um arquivo com sua conta, sua atividade no painel e seus pedidos."
        open={open === "export"} onToggle={() => toggle("export")}
      >
        <ExportForm notify={notify} onDone={close} />
      </Row>

      <Row
        icon={PencilLine} title="Pedir correção" text="Nome, e-mail, CRF ou farmácia errados? A administração corrige."
        open={open === "correcao"} onToggle={() => toggle("correcao")}
      >
        <RequestForm type="correcao" requests={requests} onDone={() => done("Pedido de correção enviado à administração.")} />
      </Row>

      <Row
        icon={UserX} title="Pedir exclusão da conta" text="Para quem deixou a farmácia ou o Sincofarma."
        open={open === "exclusao"} onToggle={() => toggle("exclusao")} danger
      >
        <RequestForm type="exclusao" requests={requests} onDone={() => done("Pedido de exclusão enviado à administração.")} />
      </Row>

      {requests.length > 0 && (
        <div className="lgpd-requests">
          <h3>Seus pedidos</h3>
          <ul>
            {requests.map((r) => (
              <li key={r.id}>
                <div className="lgpd-request-head">
                  <strong>{REQUEST_TYPES[r.type] ?? r.type}</strong>
                  <span className={`lgpd-status lgpd-status--${REQUEST_STATUS[r.status]?.tone ?? "amber"}`}>
                    {REQUEST_STATUS[r.status]?.label ?? r.status}
                  </span>
                </div>
                <small>Enviado em {day(r.at)}{r.resolvedAt ? ` · respondido em ${day(r.resolvedAt)}` : ""}</small>
                {r.response && <p className="lgpd-response">{r.response}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link to="/privacidade" className="lgpd-policy-link">
        <FileText size={15} aria-hidden="true" /> Política de privacidade do painel
      </Link>
    </SpotlightCard>
  );
}

function ExportForm({ notify, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setError("");
    setBusy(true);
    try {
      const data = await repository.getMyData();
      downloadJson(datedName("sincofarma-meus-dados"), data);
      notify("Arquivo baixado. Guarde em local seguro: ele tem seu CPF e e-mail.", "success");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-form">
      <p className="account-text">
        O arquivo (formato JSON, abre em qualquer editor de texto) traz seus dados de cadastro, os aparelhos
        lembrados, o que você fez no painel com data e protocolo, seus pedidos e com quem os dados são
        compartilhados. Dados de pacientes não entram: eles pertencem aos pacientes.
      </p>
      {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
      <div className="account-actions">
        <button type="button" className="btn btn--primary" onClick={run} disabled={busy}>
          <Download size={16} /> {busy ? "Preparando…" : "Baixar arquivo"}
        </button>
      </div>
    </div>
  );
}

function RequestForm({ type, requests, onDone }) {
  const [details, setDetails] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = requests.some((r) => r.type === type && r.status === "aberto");
  const exclusao = type === "exclusao";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!exclusao && details.trim().length < 5) return setError("Diga o que precisa ser corrigido.");
    // exclusão: primeiro clique só pede confirmação
    if (exclusao && !confirm) return setConfirm(true);
    setBusy(true);
    try {
      await repository.createMyRequest({ type, details: details.trim() });
      setDetails("");
      setConfirm(false);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return <p className="account-text">Você já tem um pedido deste tipo em análise. A resposta aparece aqui embaixo.</p>;
  }

  return (
    <form className="account-form" onSubmit={submit} noValidate>
      {exclusao ? (
        <p className="account-text">
          Ao aprovar, a administração <b>anonimiza</b> sua conta: nome, e-mail, CPF, CRF e app autenticador
          são apagados e você perde o acesso. Os atendimentos que você registrou continuam, como exige a
          norma sanitária, ligados a um código interno e ao nome de responsável técnico que assinou cada um.
        </p>
      ) : (
        <p className="account-text">Diga o que está errado e o valor certo. A administração confere e corrige.</p>
      )}
      <label className="field">
        <span>{exclusao ? "MOTIVO (OPCIONAL)" : "O QUE CORRIGIR"}</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={exclusao ? "Ex.: deixei a farmácia" : "Ex.: meu e-mail mudou para ana@novo.com.br"}
        />
      </label>
      {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
      <div className="account-actions">
        {confirm && (
          <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)}>Voltar</button>
        )}
        <button
          type="submit"
          className={`btn ${exclusao && confirm ? "btn--danger-solid" : "btn--primary"}`}
          disabled={busy}
        >
          {busy ? "Enviando…" : exclusao ? (confirm ? "Confirmar pedido de exclusão" : "Pedir exclusão") : "Enviar pedido"}
        </button>
      </div>
    </form>
  );
}
