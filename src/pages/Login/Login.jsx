import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useAnimate } from "framer-motion";
import {
  ShieldCheck,
  IdCard,
  Lock,
  ArrowRight,
  Info,
  Eye,
  EyeClosed,
  Check,
  AlertCircle,
  TriangleAlert,
  Smartphone,
} from "lucide-react";
import { totpUri } from "../../services/cognito";
import { useAuth } from "../../contexts/auth";
import logo from "../../assets/logo-sincofarma.webp";
import LightBeams from "../../components/LightBeams";
import { EASE, pulse, rise as riseBase } from "../../utils/motion";
import { useSpotlightTilt } from "../../hooks/useSpotlightTilt";
import { COMPLIANCE, DEMO_MODE } from "../../config/app";
import "./Login.css";

// entrada escalonada de cada bloco do card (mesma linguagem do painel)
const rise = (i) => riseBase(i, 0.35);

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | success
  // etapa pendente do Cognito: { type, username, session, secret?, qr? }
  // NEW_PASSWORD_REQUIRED (senha temporária do gestor), MFA_SETUP (cadastrar o
  // app autenticador) ou SOFTWARE_TOKEN_MFA (código de 6 dígitos)
  const [challenge, setChallenge] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const { signIn, completeNewPassword, startTotpSetup, finishTotpSetup, answerTotp } = useAuth();
  const navigate = useNavigate();
  // motivo de um encerramento automático (lido uma vez e apagado)
  const [idleLogout] = useState(() => {
    try {
      return sessionStorage.getItem("sinco:logout-reason") === "idle";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.removeItem("sinco:logout-reason");
    } catch {
      /* ignora */
    }
  }, []);
  const [cardScope, animateCard] = useAnimate();
  const navTimer = useRef(null);
  useEffect(() => () => clearTimeout(navTimer.current), []);

  const loading = status === "loading";
  const success = status === "success";

  // efeito 3D + holofote seguindo o mouse (mesmo hook dos cards do painel)
  const tilt = useSpotlightTilt(8);

  /** Mostra a próxima etapa pedida pelo Cognito (podem vir várias em sequência). */
  async function enterChallenge(err) {
    const next = { type: err.challenge, username: err.username, session: err.session };
    if (next.type === "MFA_SETUP") {
      const setup = await startTotpSetup(next);
      const QRCode = await import("qrcode");
      // no rótulo do app vai só o fim do CPF: o celular não precisa do documento inteiro
      const account = `***${String(next.username).slice(-4)}`;
      const qr = await QRCode.toDataURL(totpUri(setup.secret, account), { margin: 1, width: 176 });
      Object.assign(next, { session: setup.session, secret: setup.secret, qr });
    }
    setChallenge(next);
    setPassword("");
    setMfaCode("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || success) return;
    setError("");
    const type = challenge?.type;
    if (type === "NEW_PASSWORD_REQUIRED") {
      const policy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;
      if (!policy.test(newPassword)) {
        setError("A nova senha precisa de 12 caracteres ou mais, com maiúscula, minúscula e número.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("As senhas não conferem.");
        return;
      }
    }
    if ((type === "MFA_SETUP" || type === "SOFTWARE_TOKEN_MFA") && !/^\d{6}$/.test(mfaCode)) {
      setError("Digite os 6 números mostrados no app autenticador.");
      return;
    }
    setStatus("loading");
    try {
      if (type === "NEW_PASSWORD_REQUIRED") await completeNewPassword(challenge, newPassword);
      else if (type === "MFA_SETUP") await finishTotpSetup(challenge, mfaCode);
      else if (type === "SOFTWARE_TOKEN_MFA") await answerTotp(challenge, mfaCode);
      else await signIn(identifier, password);
      setStatus("success");
      // "/" leva à primeira tela do perfil (farmacêutico, médico ou administração)
      navTimer.current = setTimeout(() => navigate("/"), 800);
    } catch (err) {
      let failure = err;
      if (err.code === "Challenge") {
        try {
          await enterChallenge(err);
          setStatus("idle");
          return;
        } catch (setupErr) {
          failure = setupErr;
        }
      }
      setStatus("idle");
      setMfaCode("");
      // sessão do Cognito vencida: volta para o CPF e senha
      if (challenge && /expirada|esgotado/.test(failure.message || "")) setChallenge(null);
      setError(failure.message || "Não foi possível acessar.");
      animateCard(
        cardScope.current,
        { x: [0, -10, 10, -8, 8, -4, 4, 0] },
        { duration: 0.5, ease: "easeOut" }
      );
    }
  }

  const fieldProps = (name) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  });

  return (
    <div className="login-page">
      <motion.header
        className="login-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <motion.img
          src={logo}
          alt="Sincofarma DF"
          whileHover={{ scale: 1.04 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        />
      </motion.header>

      <main className="login-main">
        <div className="login-bg" aria-hidden="true">
          <div className="bg-noise" />
          <div className="glow glow--top" />
          <motion.div
            className="glow glow--top-pulse"
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={pulse(8)}
          />
          <motion.div
            className="glow glow--bottom"
            animate={{ opacity: [0.35, 0.6, 0.35] }}
            transition={pulse(6, 1)}
          />
          <motion.div
            className="glow glow--spot glow--spot-a"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={pulse(3)}
          />
          <motion.div
            className="glow glow--spot glow--spot-b"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={pulse(3, 1)}
          />
        </div>

        <motion.div
          className="login-stage"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <motion.div
            className="login-tilt"
            style={tilt.style}
            {...tilt.handlers}
          >
            <motion.div
              className={`card-glow${success ? " is-success" : ""}`}
              aria-hidden="true"
              animate={{ opacity: [0.45, 0.9, 0.45] }}
              transition={pulse(4)}
            />

            <section ref={cardScope} className={`login-card${success ? " is-success" : ""}`}>
              <div className="card-spotlight" aria-hidden="true" />
              <div className="card-pattern" aria-hidden="true" />
              <LightBeams />

              <motion.div
                className="login-icon"
                initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                animate={
                  success
                    ? { scale: [1, 1.18, 1], opacity: 1, rotate: 0 }
                    : { scale: 1, opacity: 1, rotate: 0 }
                }
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: success ? 0 : 0.25 }}
                whileHover={{ rotate: -8, scale: 1.08 }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={success ? "ok" : "shield"}
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 45 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className="login-icon-inner"
                  >
                    {success ? <Check size={26} /> : <ShieldCheck size={26} />}
                  </motion.span>
                </AnimatePresence>
              </motion.div>

              <motion.h1 {...rise(0)}>Acesso Institucional</motion.h1>
              <motion.p className="login-subtitle" {...rise(1)}>
                Ambiente restrito a Farmacêuticos Responsáveis Técnicos (RT) e
                Gestores Homologados CRF-DF.
              </motion.p>

              <motion.hr
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.7, ease: EASE }}
              />

              {idleLogout && !error && (
                <p className="login-idle" role="status">
                  Sua sessão foi encerrada por inatividade. Entre novamente para continuar.
                </p>
              )}

              <form onSubmit={handleSubmit} noValidate>
                {challenge && challenge.type !== "NEW_PASSWORD_REQUIRED" ? (
                  <motion.div
                    className="new-password"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    {challenge.type === "MFA_SETUP" ? (
                      <>
                        <p className="login-idle" role="status">
                          Verificação em duas etapas: abra um app autenticador (Google Authenticator,
                          Microsoft Authenticator ou similar), leia o QR code e digite o código gerado.
                        </p>
                        <img className="mfa-qr" src={challenge.qr} alt="QR code para o app autenticador" width={176} height={176} />
                        <p className="mfa-secret">
                          Sem câmera? Digite esta chave no app:
                          <code>{challenge.secret.match(/.{1,4}/g).join(" ")}</code>
                        </p>
                      </>
                    ) : (
                      <p className="login-idle" role="status">
                        Digite o código de 6 dígitos do seu app autenticador.
                      </p>
                    )}
                    <label htmlFor="mfa-code">Código do app autenticador</label>
                    <div className={`input-wrap${mfaCode ? " has-value" : ""}`}>
                      <Smartphone size={18} className="input-icon" />
                      <input
                        id="mfa-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="000000"
                        value={mfaCode}
                        onChange={(e) => {
                          setMfaCode(e.target.value.replace(/\D/g, ""));
                          if (error) setError("");
                        }}
                        required
                      />
                    </div>
                  </motion.div>
                ) : challenge ? (
                  <motion.div
                    className="new-password"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <p className="login-idle" role="status">
                      Primeiro acesso: defina sua senha pessoal. Mínimo de 12 caracteres, com
                      maiúscula, minúscula e número.
                    </p>
                    <label htmlFor="new-password">Nova senha</label>
                    <div className={`input-wrap${newPassword ? " has-value" : ""}`}>
                      <Lock size={18} className="input-icon" />
                      <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <label htmlFor="confirm-password" className="label-gap">Confirme a nova senha</label>
                    <div className={`input-wrap${confirmPassword ? " has-value" : ""}`}>
                      <Lock size={18} className="input-icon" />
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                  </motion.div>
                ) : (
                  <>
                <motion.div {...rise(3)}>
                  <label htmlFor="identifier" className={focused === "identifier" ? "is-focused" : ""}>
                    Número do CRF-DF ou CPF
                  </label>
                  <motion.div
                    className={`input-wrap${identifier ? " has-value" : ""}${focused === "identifier" ? " is-focused" : ""}`}
                    whileHover={{ scale: 1.01 }}
                    animate={{ scale: focused === "identifier" ? 1.02 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    {focused === "identifier" && (
                      <motion.span layoutId="input-highlight" className="input-highlight" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                    )}
                    <IdCard size={18} className="input-icon" />
                    <input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      placeholder="Ex: CRF 12345/DF ou 000.***.***-00"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (error) setError("");
                      }}
                      {...fieldProps("identifier")}
                      required
                    />
                  </motion.div>
                </motion.div>

                <motion.div {...rise(4)}>
                  <div className="label-row">
                    <label htmlFor="password" className={focused === "password" ? "is-focused" : ""}>
                      Senha de acesso
                    </label>
                    <button
                      type="button"
                      className="link-underline link-btn"
                      onClick={() => setHelp((v) => !v)}
                      aria-expanded={help}
                      aria-controls="login-help"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <motion.div
                    className={`input-wrap${password ? " has-value" : ""}${focused === "password" ? " is-focused" : ""}`}
                    whileHover={{ scale: 1.01 }}
                    animate={{ scale: focused === "password" ? 1.02 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    {focused === "password" && (
                      <motion.span layoutId="input-highlight" className="input-highlight" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                    )}
                    <Lock size={18} className="input-icon" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                      {...fieldProps("password")}
                      required
                    />
                    <motion.button
                      type="button"
                      className="eye-btn"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      whileTap={{ scale: 0.85 }}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={showPassword ? "open" : "closed"}
                          initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.5, rotate: 30 }}
                          transition={{ duration: 0.18 }}
                          className="eye-icon"
                        >
                          {showPassword ? <Eye size={18} /> : <EyeClosed size={18} />}
                        </motion.span>
                      </AnimatePresence>
                    </motion.button>
                  </motion.div>
                </motion.div>

                  </>
                )}

                <AnimatePresence initial={false}>
                  {help && (
                    <motion.p
                      key="help"
                      id="login-help"
                      className="login-help"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      A redefinição de senha é feita pelo gestor da unidade. Procure a administração
                      da farmácia com seu número de CRF.
                    </motion.p>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="error"
                      className="form-error"
                      role="alert"
                      initial={{ opacity: 0, height: 0, y: -6 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -6 }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <span className="form-error-inner">
                        <AlertCircle size={14} />
                        {error}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div {...rise(5)}>
                  <motion.button
                    type="submit"
                    className={`btn-primary${loading ? " is-loading" : ""}${success ? " is-success" : ""}`}
                    disabled={loading || success}
                    whileHover={loading || success ? undefined : { scale: 1.02, y: -1 }}
                    whileTap={loading || success ? undefined : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  >
                    <span className="btn-glow" aria-hidden="true" />
                    <motion.span
                      className="btn-shimmer"
                      aria-hidden="true"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6 }}
                      style={{ opacity: loading ? 1 : 0 }}
                    />
                    <AnimatePresence mode="wait" initial={false}>
                      {loading ? (
                        <motion.span
                          key="loading"
                          className="btn-content"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span className="btn-spinner" />
                          Validando
                        </motion.span>
                      ) : success ? (
                        <motion.span
                          key="success"
                          className="btn-content"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 18 }}
                        >
                          <Check size={16} />
                          Acesso liberado
                        </motion.span>
                      ) : (
                        <motion.span
                          key="idle"
                          className="btn-content"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.2 }}
                        >
                          {challenge?.type === "NEW_PASSWORD_REQUIRED"
                            ? "Salvar senha e entrar"
                            : challenge?.type === "MFA_SETUP"
                              ? "Ativar e entrar"
                              : challenge
                                ? "Confirmar código"
                                : "Acessar Plataforma"}
                          <ArrowRight size={16} className="btn-arrow" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.div>
              </form>

              <motion.hr
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.75, duration: 0.7, ease: EASE }}
              />

              {(COMPLIANCE.icpBrasil || COMPLIANCE.lgpd) && (
                <div className="badges">
                  {[
                    COMPLIANCE.icpBrasil && { tag: "ICP", title: "ICP-Brasil", desc: "Certificação Digital Homologada" },
                    COMPLIANCE.lgpd && { tag: "LGPD", title: "Em Conformidade", desc: "Dados em Saúde Protegidos" },
                  ]
                    .filter(Boolean)
                    .map((b, i) => (
                      <motion.div
                        key={b.tag}
                        className="badge"
                        {...rise(7 + i)}
                        whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 15 } }}
                      >
                        <span className="badge-tag">{b.tag}</span>
                        <div>
                          <strong>{b.title}</strong>
                          <small>{b.desc}</small>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}

              {DEMO_MODE ? (
                <motion.div className="notice notice--warn" role="note" {...rise(8)}>
                  <span className="notice-icon"><TriangleAlert size={16} /></span>
                  <p>
                    <strong>Ambiente de demonstração.</strong> Os dados exibidos são fictícios e
                    ficam salvos só neste navegador. Não insira dados reais de pacientes.
                  </p>
                </motion.div>
              ) : (
                <motion.div className="notice" role="note" {...rise(8)}>
                  <motion.span
                    className="notice-icon"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={pulse(3)}
                  >
                    <Info size={16} />
                  </motion.span>
                  <p>
                    <strong>Acesso restrito.</strong> Uso exclusivo de farmacêuticos e gestores
                    autorizados. As ações ficam registradas com seu usuário.
                  </p>
                </motion.div>
              )}
            </section>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
