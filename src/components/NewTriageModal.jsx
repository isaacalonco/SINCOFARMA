import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Stethoscope, TriangleAlert, Check } from "lucide-react";
import { useClinic } from "../contexts/clinic";
import { useAuth } from "../contexts/AuthContext";
import { STATUS } from "../pages/Dashboard/data";

const KNOWN_RTS = ["Dra. Ana Souza", "Dr. Rafael Mendes"];

function maskCpf(value) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

// LGPD: guarda só os dígitos finais
function anonymizeCpf(masked) {
  return `***${masked.slice(3)}`;
}

function validate(form) {
  const errors = {};
  if (form.name.trim().split(/\s+/).length < 2) errors.name = "Informe nome e sobrenome.";
  if (form.cpf.replace(/\D/g, "").length !== 11) errors.cpf = "CPF precisa ter 11 dígitos.";
  if (form.complaint.trim().length < 3) errors.complaint = "Descreva a queixa principal.";
  return errors;
}

function TriageForm({ onClose }) {
  const { addVisit } = useClinic();
  const { user } = useAuth();
  const rts = [...new Set([user?.name, ...KNOWN_RTS].filter(Boolean))];

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    complaint: "",
    signs: "",
    rt: rts[0],
    status: "progress",
    urgent: false,
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const set = (key) => (e) => {
    const value = key === "cpf" ? maskCpf(e.target.value) : e.target.value;
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched) setErrors(validate(next));
  };

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setTouched(true);
    if (Object.keys(errs).length) return;
    addVisit({
      name: form.name.trim().replace(/\s+/g, " "),
      cpf: anonymizeCpf(form.cpf),
      complaint: form.complaint.trim(),
      signs: form.signs.trim(),
      rt: form.rt,
      status: form.status,
      urgent: form.urgent,
    });
    onClose();
  }

  const field = (key) => ({
    className: `field${errors[key] ? " has-error" : ""}`,
  });

  return (
    <form className="modal-body" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <div {...field("name")} style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="t-name">NOME DO PACIENTE</label>
          <input
            id="t-name"
            ref={firstRef}
            value={form.name}
            onChange={set("name")}
            placeholder="Nome completo"
            autoComplete="off"
          />
          <FieldError msg={errors.name} />
        </div>

        <div {...field("cpf")}>
          <label htmlFor="t-cpf">CPF</label>
          <input
            id="t-cpf"
            value={form.cpf}
            onChange={set("cpf")}
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoComplete="off"
          />
          <FieldError msg={errors.cpf} />
        </div>

        <div className="field">
          <label htmlFor="t-rt">RT RESPONSÁVEL</label>
          <select id="t-rt" value={form.rt} onChange={set("rt")}>
            {rts.map((rt) => (
              <option key={rt}>{rt}</option>
            ))}
          </select>
        </div>

        <div {...field("complaint")} style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="t-complaint">QUEIXA PRINCIPAL</label>
          <input
            id="t-complaint"
            value={form.complaint}
            onChange={set("complaint")}
            placeholder="Ex: Cefaleia tensional e febre leve"
          />
          <FieldError msg={errors.complaint} />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="t-signs">SINAIS VITAIS / OBSERVAÇÕES</label>
          <textarea
            id="t-signs"
            rows={2}
            value={form.signs}
            onChange={set("signs")}
            placeholder="Ex: Tax 37.8 °C · PA 120/80 mmHg"
          />
        </div>
      </div>

      <fieldset className="field">
        <legend>DESFECHO</legend>
        <div className="segmented">
          {Object.entries(STATUS).map(([key, s]) => (
            <button
              type="button"
              key={key}
              className={`seg seg--${s.tone}${form.status === key ? " is-active" : ""}`}
              onClick={() => setForm((f) => ({ ...f, status: key }))}
              aria-pressed={form.status === key}
            >
              {form.status === key && (
                <motion.span layoutId="seg-new" className="seg-bg" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
              <span className="seg-label">{s.short}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        className={`flag-toggle${form.urgent ? " is-on" : ""}`}
        onClick={() => setForm((f) => ({ ...f, urgent: !f.urgent }))}
        aria-pressed={form.urgent}
      >
        <span className="switch"><i /></span>
        <TriangleAlert size={16} />
        <span>
          <b>Red Flag</b> · sinal de alerta, priorizar na fila regulada
        </span>
      </button>

      <footer className="modal-foot">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary">
          <Check size={16} /> Registrar triagem
        </button>
      </footer>
    </form>
  );
}

function FieldError({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.small
          className="field-error"
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
        >
          {msg}
        </motion.small>
      )}
    </AnimatePresence>
  );
}

export default function NewTriageModal() {
  const { triageOpen, closeTriage } = useClinic();

  useEffect(() => {
    if (!triageOpen) return;
    const onKey = (e) => e.key === "Escape" && closeTriage();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [triageOpen, closeTriage]);

  return (
    <AnimatePresence>
      {triageOpen && (
        <motion.div
          className="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && closeTriage()}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="triage-title"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <header className="modal-head">
              <span className="modal-icon"><Stethoscope size={18} /></span>
              <div>
                <h2 id="triage-title">Nova Triagem</h2>
                <p>Acolhimento farmacêutico · protocolo Manchester</p>
              </div>
              <button className="icon-btn" onClick={closeTriage} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>
            <TriageForm onClose={closeTriage} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
