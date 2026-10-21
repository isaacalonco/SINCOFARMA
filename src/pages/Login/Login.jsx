import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useAnimate,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
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
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import logo from "../../assets/logo-sincofarma.svg";
import LightBeams from "../../components/LightBeams";
import { EASE, pulse } from "../../utils/motion";
import "./Login.css";

// entrada escalonada de cada bloco do card
const rise = (i) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.35 + i * 0.06, duration: 0.55, ease: EASE },
});

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [cardScope, animateCard] = useAnimate();

  const loading = status === "loading";
  const success = status === "success";

  // ---- efeito 3D + holofote seguindo o mouse ----
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 18, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 150, damping: 18, mass: 0.4 });
  const rotateX = useTransform(sy, [-300, 300], [8, -8]);
  const rotateY = useTransform(sx, [-300, 300], [-8, 8]);
  const lightX = useMotionValue(-999);
  const lightY = useMotionValue(-999);
  const spotlight = useMotionTemplate`radial-gradient(260px circle at ${lightX}px ${lightY}px, rgba(58, 160, 232, 0.12), transparent 70%)`;

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left - rect.width / 2);
    my.set(e.clientY - rect.top - rect.height / 2);
    lightX.set(e.clientX - rect.left);
    lightY.set(e.clientY - rect.top);
  }

  function handleMouseLeave() {
    mx.set(0);
    my.set(0);
    lightX.set(-999);
    lightY.set(-999);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || success) return;
    setError("");
    setStatus("loading");
    try {
      await signIn(identifier, password);
      setStatus("success");
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      setStatus("idle");
      setError(err.message || "Não foi possível acessar.");
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
            animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.98, 1.04, 0.98] }}
            transition={pulse(8)}
          />
          <motion.div
            className="glow glow--bottom"
            animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.1, 1] }}
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
            style={{ rotateX, rotateY }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <motion.div
              className={`card-glow${success ? " is-success" : ""}`}
              aria-hidden="true"
              animate={{ opacity: [0.45, 0.9, 0.45] }}
              transition={pulse(4)}
            />

            <section ref={cardScope} className={`login-card${success ? " is-success" : ""}`}>
              <motion.div className="card-spotlight" style={{ background: spotlight }} aria-hidden="true" />
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

              <form onSubmit={handleSubmit} noValidate>
                <motion.div {...rise(3)}>
                  <label htmlFor="identifier" className={focused === "identifier" ? "is-focused" : ""}>
                    NÚMERO DO CRF-DF OU CPF
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
                      SENHA DE ACESSO
                    </label>
                    <a href="#" className="link-underline">Esqueceu a senha?</a>
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
                          Acessar Plataforma
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

              <div className="badges">
                {[
                  { tag: "ICP", title: "ICP-Brasil", desc: "Certificação Digital Homologada" },
                  { tag: "LGPD", title: "Em Conformidade", desc: "Dados em Saúde Protegidos" },
                ].map((b, i) => (
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

              <motion.div className="notice" {...rise(9)}>
                <motion.span
                  className="notice-icon"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={pulse(3)}
                >
                  <Info size={16} />
                </motion.span>
                <p>
                  <strong>Aviso RNDS:</strong> As sessões clínicas, receituários e
                  triagens homologadas são sincronizados com a Rede Nacional de
                  Dados em Saúde (Ministério da Saúde).
                </p>
              </motion.div>
            </section>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
