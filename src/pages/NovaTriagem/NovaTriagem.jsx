import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import { EASE, SPRING } from "../../utils/motion";
import { digits, applyMask } from "../../utils/cpf";
import { INITIAL } from "./constants";
import { validateTriage, buildSteps, firstPending } from "./validation";
import { buildTriageRecord, computeImc } from "./record";
import Stepper from "./Stepper";
import {
  IdentificacaoSection,
  QueixaSection,
  HistoricoSection,
  SinaisSection,
  RiscoSection,
  ObservacaoSection,
} from "./sections";
import "./NovaTriagem.css";

/* Placeholder: o número real do protocolo deve vir do backend */
const newProtocol = () =>
  `SIN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;

/** Só dígitos e um único separador decimal (vírgula), até 2 casas. */
function sanitizeDecimal(value) {
  const raw = value.replace(/[^\d,.]/g, "").replace(".", ",");
  const [int, ...rest] = raw.split(",");
  return (rest.length ? `${int},${rest.join("").slice(0, 2)}` : int).slice(0, 6);
}

const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function NovaTriagem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addVisit } = useClinic();
  const [form, setForm] = useState(INITIAL);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [protocolo] = useState(newProtocol);

  const setField = useCallback((name, value) => setForm((f) => ({ ...f, [name]: value })), []);

  // fábricas de onChange (estáveis entre renders)
  const on = useMemo(
    () => ({
      text: (name) => (e) => setField(name, e.target.value),
      masked: (name, pattern) => (e) => setField(name, applyMask(e.target.value, pattern)),
      digits: (name, max) => (e) => setField(name, digits(e.target.value).slice(0, max)),
      decimal: (name) => (e) => setField(name, sanitizeDecimal(e.target.value)),
    }),
    [setField]
  );

  const toggleFlag = useCallback(
    (flag) => setForm((f) => ({
      ...f,
      redFlags: f.redFlags.includes(flag) ? f.redFlags.filter((x) => x !== flag) : [...f.redFlags, flag],
    })),
    []
  );

  const ok = validateTriage(form);
  const steps = buildSteps(form, ok);
  const imc = computeImc(form.peso, form.altura);
  const bad = (key) => tried && !ok[key];

  const pharmacist = user?.name ?? "Farmacêutico(a) responsável";
  const crf = user?.crf ? ` (${user.crf})` : "";

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setTried(true);
    const pending = firstPending(steps);
    if (pending) {
      const count = Object.values(ok).filter((v) => !v).length;
      setAnnounce(`${count} ${count === 1 ? "campo precisa" : "campos precisam"} de correção. Primeira etapa pendente: ${pending.title}.`);
      scrollToSection(pending.target);
      // leva o foco ao primeiro campo inválido da etapa
      setTimeout(() => document.querySelector(`#${pending.target} [aria-invalid="true"]`)?.focus({ preventScroll: true }), 350);
      return;
    }

    setAnnounce("");
    setSaving(true);
    try {
      const { summary, clinical } = buildTriageRecord(form, { pharmacist, protocol: protocolo });
      await addVisit(summary, clinical);
      navigate("/dashboard");
    } catch {
      // o provider já avisou o usuário; o formulário fica preenchido para tentar de novo
      setSaving(false);
    }
  }

  const sectionProps = { form, on, bad };

  return (
    <form className="triagem" onSubmit={handleSubmit} noValidate aria-labelledby="tg-title">
      <motion.header
        className="tg-header"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div>
          <h1 id="tg-title">Nova Triagem Clínica</h1>
          <p className="tg-sub">PROTOCOLO SES/DF · Registro de atendimento farmacêutico</p>
        </div>
        <div className="tg-badges">
          <span className="tg-badge tg-badge--ok">Em atendimento</span>
          <span className="tg-badge" aria-label={`Protocolo ${protocolo}`}>{protocolo}</span>
        </div>
      </motion.header>

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      <Stepper steps={steps} onGo={scrollToSection} />

      <IdentificacaoSection {...sectionProps} />
      <QueixaSection {...sectionProps} />
      <HistoricoSection form={form} setField={setField} />
      <SinaisSection {...sectionProps} imc={imc} />
      <RiscoSection {...sectionProps} toggleFlag={toggleFlag} />
      <ObservacaoSection form={form} on={on} />

      <motion.footer
        className="tg-footer"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24, delay: 0.5 }}
      >
        <motion.button
          type="button"
          className="tg-btn tg-btn--ghost"
          onClick={() => navigate("/dashboard")}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
        >
          Cancelar
        </motion.button>
        <p>Responsável técnico: {pharmacist}{crf}</p>
        <motion.button
          type="submit"
          className="tg-btn tg-btn--primary"
          disabled={saving}
          aria-busy={saving}
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
        >
          <span className="btn-shine" aria-hidden="true" />
          {saving ? "Registrando…" : "Continuar"}
        </motion.button>
      </motion.footer>
    </form>
  );
}
