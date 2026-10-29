import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Smartphone, LogOut, UserRound, Check, AlertCircle } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import { account } from "../../services/authService";
import { totpUri } from "../../services/cognito";
import { PAPEIS } from "../../services/permissoes";
import { DEMO_MODE } from "../../config/app";
import { rise } from "../../utils/motion";
import "./MinhaConta.css";

const ROLE_TONE = { farmaceutico: "green", medico: "blue", admin: "purple" };
const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;

/** A própria conta: dados, senha, app autenticador e sessões abertas. */
export default function MinhaConta() {
  const { user, signOut } = useAuth();
  const { unit, notify } = useClinic();
  const [email, setEmail] = useState(null);

  useEffect(() => {
    account.details().then((d) => setEmail(d.email ?? null), () => {});
  }, []);

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
        <SpotlightCard index={2} className="account-card">
          <h2><UserRound size={18} /> Seus dados</h2>
          <dl className="account-data">
            <div><dt>Nome</dt><dd>{user?.name}</dd></div>
            <div><dt>E-mail</dt><dd>{email ?? "—"}</dd></div>
            <div>
              <dt>Perfil</dt>
              <dd className="role-chips">
                {(user?.roles ?? []).map((r) => (
                  <span key={r} className={`role-chip role-chip--${ROLE_TONE[r] ?? "none"}`}>{PAPEIS[r] ?? r}</span>
                ))}
              </dd>
            </div>
            {user?.unit && <div><dt>Farmácia</dt><dd>{unit || user.unit}</dd></div>}
            {user?.crf && <div><dt>Registro</dt><dd>{user.crf}</dd></div>}
          </dl>
          <p className="account-note">Nome, e-mail, perfil e farmácia são alterados pela administração do Sincofarma.</p>
        </SpotlightCard>

        <PasswordCard notify={notify} />
        <TotpCard notify={notify} user={user} />
        <SessionsCard signOut={signOut} notify={notify} />
      </div>
    </main>
  );
}

function PasswordCard({ notify }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.current) return setError("Digite a senha atual.");
    if (!POLICY.test(form.next)) return setError("A nova senha precisa de 12 caracteres ou mais, com maiúscula, minúscula e número.");
    if (form.next !== form.confirm) return setError("As senhas novas não conferem.");
    setBusy(true);
    try {
      await account.changePassword(form.current, form.next);
      setForm({ current: "", next: "", confirm: "" });
      notify("Senha alterada.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SpotlightCard index={3} className="account-card">
      <h2><KeyRound size={18} /> Senha</h2>
      <form className="account-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>SENHA ATUAL</span>
          <input type="password" autoComplete="current-password" value={form.current} onChange={set("current")} />
        </label>
        <label className="field">
          <span>NOVA SENHA</span>
          <input type="password" autoComplete="new-password" value={form.next} onChange={set("next")} />
        </label>
        <label className="field">
          <span>CONFIRME A NOVA SENHA</span>
          <input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        </label>
        <small className="account-hint">Mínimo de 12 caracteres, com maiúscula, minúscula e número.</small>
        {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy || DEMO_MODE}>
          {busy ? "Salvando…" : "Trocar senha"}
        </button>
      </form>
    </SpotlightCard>
  );
}

function TotpCard({ notify, user }) {
  const [step, setStep] = useState("idle"); // idle | scan
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
      setStep("scan");
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
      setStep("idle");
      setSetup(null);
      setCode("");
      notify("Novo app autenticador ativado. O antigo deixou de valer.", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SpotlightCard index={4} className="account-card">
      <h2><Smartphone size={18} /> App autenticador</h2>
      {step === "idle" ? (
        <>
          <p className="account-text">
            Trocou de celular? Cadastre o app no aparelho novo. O código do aparelho antigo deixa de funcionar.
          </p>
          {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
          <button type="button" className="btn btn--ghost" onClick={start} disabled={busy || DEMO_MODE}>
            {busy ? "Gerando…" : "Trocar de celular"}
          </button>
        </>
      ) : (
        <form className="account-form" onSubmit={finish} noValidate>
          <p className="account-text">Leia o QR code com o app no celular novo e digite o código que aparecer.</p>
          <img className="account-qr" src={setup.qr} alt="QR code para o app autenticador" width={168} height={168} />
          <small className="account-hint">Sem câmera? Chave: <code>{setup.secret.match(/.{1,4}/g).join(" ")}</code></small>
          <label className="field">
            <span>CÓDIGO DO APP</span>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </label>
          {error && <p className="account-error" role="alert"><AlertCircle size={14} /> {error}</p>}
          <div className="account-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setStep("idle")}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Conferindo…" : "Ativar app novo"}</button>
          </div>
        </form>
      )}
    </SpotlightCard>
  );
}

function SessionsCard({ signOut, notify }) {
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
    <SpotlightCard index={5} className="account-card">
      <h2><LogOut size={18} /> Sessões</h2>
      <p className="account-text">
        Esqueceu o painel aberto em outro computador? Encerre a sessão em todos os aparelhos, inclusive neste.
      </p>
      {confirm ? (
        <div className="account-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setConfirm(false)}>Voltar</button>
          <button type="button" className="btn btn--danger-solid" onClick={everywhere} disabled={busy}>
            {busy ? "Encerrando…" : <><Check size={14} /> Sair de todos</>}
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn--ghost btn--danger" onClick={() => setConfirm(true)}>
          Sair de todos os aparelhos
        </button>
      )}
    </SpotlightCard>
  );
}
