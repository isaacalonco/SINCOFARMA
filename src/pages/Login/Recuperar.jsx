import { useState } from "react";
import { motion } from "framer-motion";
import { IdCard, Lock, KeyRound, AlertCircle, ArrowLeft } from "lucide-react";
import { account } from "../../services/authService";
import { EASE } from "../../utils/motion";

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;

/** "Esqueci a senha": código por e-mail (Cognito) e senha nova, dentro do cartão de login. */
export default function Recuperar({ initialIdentifier, onDone, onCancel }) {
  const [step, setStep] = useState("request"); // request | confirm
  const [identifier, setIdentifier] = useState(initialIdentifier ?? "");
  const [destination, setDestination] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (step === "request") {
      if (!identifier.replace(/\D/g, "")) return setError("Digite seu CPF ou número do CRF.");
    } else {
      if (!/^\d{6}$/.test(code)) return setError("Digite o código de 6 números do e-mail.");
      if (!POLICY.test(password)) return setError("A nova senha precisa de 12 caracteres ou mais, com maiúscula, minúscula e número.");
      if (password !== confirm) return setError("As senhas não conferem.");
    }
    setBusy(true);
    try {
      if (step === "request") {
        setDestination(await account.forgotPassword(identifier));
        setStep("confirm");
      } else {
        await account.confirmForgotPassword(identifier, code, password);
        onDone("Senha redefinida. Entre com a senha nova.");
      }
    } catch (err) {
      setError(err.message || "Não foi possível continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.form
      className="new-password recover"
      onSubmit={submit}
      noValidate
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      {step === "request" ? (
        <>
          <p className="login-idle" role="status">
            Digite seu CPF ou CRF. Se o cadastro existir, enviamos um código para o e-mail da conta.
          </p>
          <label htmlFor="rec-id">Número do CRF-DF ou CPF</label>
          <div className={`input-wrap${identifier ? " has-value" : ""}`}>
            <IdCard size={18} className="input-icon" />
            <input id="rec-id" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <p className="login-idle" role="status">
            Enviamos um código para {destination ? <b>{destination}</b> : "o e-mail da conta"}. Ele vale por 1 hora.
          </p>
          <label htmlFor="rec-code">Código do e-mail</label>
          <div className={`input-wrap${code ? " has-value" : ""}`}>
            <KeyRound size={18} className="input-icon" />
            <input id="rec-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <label htmlFor="rec-pass" className="label-gap">Nova senha</label>
          <div className={`input-wrap${password ? " has-value" : ""}`}>
            <Lock size={18} className="input-icon" />
            <input id="rec-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label htmlFor="rec-pass2" className="label-gap">Confirme a nova senha</label>
          <div className={`input-wrap${confirm ? " has-value" : ""}`}>
            <Lock size={18} className="input-icon" />
            <input id="rec-pass2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </>
      )}

      {error && (
        <div className="form-error" role="alert">
          <span className="form-error-inner"><AlertCircle size={14} /> {error}</span>
        </div>
      )}

      <button type="submit" className="btn-primary recover-submit" disabled={busy}>
        <span className="btn-content">{busy ? "Aguarde…" : step === "request" ? "Enviar código" : "Salvar senha nova"}</span>
      </button>
      <button type="button" className="link-underline link-btn recover-back" onClick={onCancel}>
        <ArrowLeft size={14} /> Voltar para o login
      </button>
    </motion.form>
  );
}
