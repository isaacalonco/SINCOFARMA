import { cloneElement, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, UserCog, Mail, Smartphone, Power, AlertCircle } from "lucide-react";
import { repository } from "../../data";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import { PAPEIS } from "../../services/permissoes";
import { digits, isValidCpf, maskCpf } from "../../utils/cpf";
import { useFocusTrap, useModalBackdrop } from "../../hooks/useFocusTrap";

const EMPTY = { name: "", cpf: "", email: "", roles: [], unit: "", crf: "" };

/** Cadastro (user = null) ou gestão de um usuário: perfis, farmácia e acesso. */
export default function UserModal({ open, user, units, onClose, onSaved }) {
  return (
    <AnimatePresence>
      {/* a cada abertura o formulário nasce de novo, já com os dados da pessoa */}
      {open && <UserDialog key={user?.id ?? "new"} user={user} units={units} onClose={onClose} onSaved={onSaved} />}
    </AnimatePresence>
  );
}

function UserDialog({ user, units, onClose, onSaved }) {
  const { user: me } = useAuth();
  const { notify } = useClinic();
  const creating = !user;
  const self = user && me?.sub === user.id;
  const [form, setForm] = useState(() => (user ? { ...EMPTY, roles: user.roles, unit: user.unit ?? "" } : EMPTY));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null); // ação em andamento
  const [confirm, setConfirm] = useState(null); // "disable" | "mfa"
  const ref = useRef(null);
  useFocusTrap(ref, true, { onClose, initialFocus: ".modal-head h2" });
  useModalBackdrop(true, ".overlay, .toasts");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleRole = (r) =>
    setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));
  const isPharm = form.roles.includes("farmaceutico");

  function check() {
    const e = {};
    if (creating) {
      if (form.name.trim().length < 3) e.name = "Informe o nome completo.";
      if (!isValidCpf(form.cpf)) e.cpf = "CPF inválido.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = "E-mail inválido.";
      if (isPharm && !digits(form.crf)) e.crf = "CRF obrigatório para farmacêutico.";
    }
    if (!form.roles.length) e.roles = "Escolha ao menos um perfil.";
    if (isPharm && !form.unit) e.unit = "Farmacêutico precisa de uma farmácia.";
    if (self && !form.roles.includes("admin")) e.roles = "Você não pode tirar o próprio perfil de administração.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function run(action, call, message) {
    setBusy(action);
    try {
      const updated = await call();
      onSaved(updated, creating);
      if (message) notify(message, "success");
      if (creating || action === "save") onClose();
      setConfirm(null);
    } catch (err) {
      setErrors(err.data?.details?.fields ?? {});
      notify(err.message || "Não foi possível salvar.", "error");
    } finally {
      setBusy(null);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (!check()) return;
    if (creating) {
      const body = { name: form.name.trim(), cpf: digits(form.cpf), email: form.email.trim(), roles: form.roles, unit: form.unit || null, crf: isPharm ? digits(form.crf) : null };
      run("save", () => repository.createUser(body));
      return;
    }
    const change = {};
    if ([...form.roles].sort().join() !== [...user.roles].sort().join()) change.roles = form.roles;
    if ((form.unit || null) !== (user.unit ?? null)) change.unit = form.unit || null;
    if (!Object.keys(change).length) return onClose();
    run("save", () => repository.updateUser(user.id, change), `Perfil de ${user.name.split(" ")[0]} atualizado.`);
  }

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        ref={ref}
        className="modal user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        noValidate
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        <header className="modal-head">
          <span className="modal-icon">{creating ? <UserPlus size={18} /> : <UserCog size={18} />}</span>
          <div>
            <h2 id="user-modal-title" tabIndex={-1}>{creating ? "Novo usuário" : user.name}</h2>
            <p>{creating ? "A pessoa recebe por e-mail uma senha temporária." : [user.email, `CPF ${user.cpf}`].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="modal-body">
          {creating && (
            <div className="form-grid">
              <Field label="NOME COMPLETO" error={errors.name} wide>
                <input value={form.name} onChange={set("name")} autoComplete="off" />
              </Field>
              <Field label="CPF (LOGIN)" error={errors.cpf}>
                <input value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))} inputMode="numeric" placeholder="000.000.000-00" />
              </Field>
              <Field label="E-MAIL" error={errors.email}>
                <input type="email" value={form.email} onChange={set("email")} placeholder="nome@exemplo.com.br" />
              </Field>
            </div>
          )}

          <fieldset className={`field${errors.roles ? " has-error" : ""}`}>
            <legend>PERFIL DE ACESSO</legend>
            <div className="role-picks">
              {Object.entries(PAPEIS).map(([r, label]) => (
                <label key={r} className={`role-pick role-pick--${r}${form.roles.includes(r) ? " is-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={form.roles.includes(r)}
                    onChange={() => toggleRole(r)}
                    disabled={self && r === "admin"}
                  />
                  {label}
                </label>
              ))}
            </div>
            {errors.roles && <small className="field-error">{errors.roles}</small>}
          </fieldset>

          <div className="form-grid">
            <Field label={isPharm ? "FARMÁCIA" : "FARMÁCIA (OPCIONAL)"} error={errors.unit}>
              <select value={form.unit} onChange={set("unit")}>
                <option value="">Nenhuma</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
            {creating && isPharm && (
              <Field label="CRF-DF" error={errors.crf}>
                <input value={form.crf} onChange={set("crf")} inputMode="numeric" placeholder="Só números" />
              </Field>
            )}
          </div>

          {!creating && (
            <section className="access-box" aria-label="Acesso">
              <h3>Acesso</h3>
              {user.pending && (
                <AccessRow icon={Mail} title="Aguardando o primeiro acesso" text="Mande de novo o e-mail com a senha temporária.">
                  <button type="button" className="btn btn--ghost" disabled={!!busy}
                    onClick={() => run("invite", () => repository.updateUser(user.id, { resendInvite: true }), `Convite reenviado para ${user.email}.`)}>
                    Reenviar convite
                  </button>
                </AccessRow>
              )}
              <AccessRow icon={Smartphone} title="App autenticador (MFA)" text="Perdeu o celular? No próximo login a pessoa cadastra o app de novo.">
                {confirm === "mfa" ? (
                  <ConfirmButtons busy={busy === "mfa"} onCancel={() => setConfirm(null)}
                    onConfirm={() => run("mfa", () => repository.updateUser(user.id, { resetMfa: true }), "App autenticador resetado. A sessão da pessoa foi encerrada.")} />
                ) : (
                  <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => setConfirm("mfa")}>Resetar MFA</button>
                )}
              </AccessRow>
              <AccessRow icon={Power} title={user.enabled ? "Conta ativa" : "Conta desativada"}
                text={user.enabled ? "Desativar encerra as sessões na hora e bloqueia o login. O histórico fica guardado." : "A pessoa volta a entrar com a mesma senha e o mesmo app."}>
                {self ? (
                  <small className="muted">É a sua conta</small>
                ) : user.enabled && confirm === "disable" ? (
                  <ConfirmButtons danger busy={busy === "enable"} onCancel={() => setConfirm(null)}
                    onConfirm={() => run("enable", () => repository.updateUser(user.id, { enabled: false }), `${user.name.split(" ")[0]} não acessa mais o painel.`)} />
                ) : (
                  <button type="button" className={`btn btn--ghost${user.enabled ? " btn--danger" : ""}`} disabled={!!busy}
                    onClick={() => (user.enabled ? setConfirm("disable") : run("enable", () => repository.updateUser(user.id, { enabled: true }), "Conta reativada."))}>
                    {user.enabled ? "Desativar" : "Reativar"}
                  </button>
                )}
              </AccessRow>
            </section>
          )}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={!!busy}>
            {busy === "save" ? "Salvando…" : creating ? "Cadastrar e enviar convite" : "Salvar perfil"}
          </button>
        </footer>
      </motion.form>
    </motion.div>
  );
}

function Field({ label, error, wide, children }) {
  const id = useId();
  return (
    <div className={`field${error ? " has-error" : ""}${wide ? " field--wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, "aria-invalid": !!error || undefined })}
      {error && (
        <small className="field-error"><AlertCircle size={12} /> {error}</small>
      )}
    </div>
  );
}

function AccessRow({ icon: Icon, title, text, children }) {
  return (
    <div className="access-row">
      <span className="access-icon"><Icon size={16} /></span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
      <div className="access-action">{children}</div>
    </div>
  );
}

function ConfirmButtons({ onConfirm, onCancel, busy, danger }) {
  return (
    <span className="confirm-pair">
      <button type="button" className="btn btn--ghost" onClick={onCancel}>Voltar</button>
      <button type="button" className={`btn ${danger ? "btn--danger-solid" : "btn--primary"}`} onClick={onConfirm} disabled={busy}>
        {busy ? "Aguarde…" : "Confirmar"}
      </button>
    </span>
  );
}
