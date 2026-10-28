import { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import { EASE, SPRING } from "../../utils/motion";
import { parseBrDate, startOfDay } from "../../utils/dates";
import { digits, applyMask, isValidCpf, anonymizeCpf } from "../../utils/cpf";
import "./NovaTriagem.css";

/* Constantes */

const RISK_LEVELS = [
  { id: "azul", label: "Azul", hint: "Não urgente" },
  { id: "verde", label: "Verde", hint: "Pouco urgente" },
  { id: "amarelo", label: "Amarelo", hint: "Urgente" },
  { id: "laranja", label: "Laranja", hint: "Muito urgente" },
  { id: "vermelho", label: "Vermelho", hint: "Imediato" },
];

const RED_FLAGS = ["Dor torácica", "Dispneia", "Déficit neurológico", "Síncope"];

/* Apenas exemplo. Trocar por uma busca real.*/
const CODE_SUGGESTIONS = [
  "CIAP-2 A03 · Febre",
  "CIAP-2 N01 · Cefaleia",
  "CIAP-2 R05 · Tosse",
  "CIAP-2 R02 · Dispneia",
];

const OBS_LIMIT = 500;

/* faixas plausíveis para aferição em farmácia (fora disso é erro de digitação) */
const RANGES = {
  paSis: [60, 260],
  paDia: [30, 160],
  fc: [20, 250],
  spo2: [50, 100],
  temp: [30, 45],
  peso: [1, 400],
  altura: [30, 250],
};
const inRange = (v, [min, max]) => {
  const n = toNum(v);
  return Number.isFinite(n) && n >= min && n <= max;
};
const rangeMsg = (label, [min, max], unit) => `${label} entre ${min} e ${max} ${unit}.`;

const INITIAL = {
  cpf: "", cns: "", nome: "", nascimento: "", sexo: "", telefone: "",
  queixa: "", codigo: "", inicioSintomas: "",
  alergias: [], comorbidades: [], medicamentos: [],
  paSis: "", paDia: "", fc: "", spo2: "", temp: "", peso: "", altura: "",
  risco: "", redFlags: [], observacoes: "",
};

/* Utilitários */

const toNum = (v) => Number(String(v).replace(",", "."));

function isValidDate(masked) {
  const d = parseBrDate(masked);
  return !!d && d <= new Date();
}

/* Placeholder: o número real do protocolo deve vir do backend */
const newProtocol = () =>
  `SIN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;

/* Componentes pequenos */

function Field({ label, invalid, error, className = "", children }) {
  return (
    <motion.label
      className={`tg-field ${invalid ? "is-invalid" : ""} ${className}`}
      animate={invalid ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <span className="tg-label">{label}</span>
      {children}
      <AnimatePresence initial={false}>
        {invalid && error && (
          <motion.span
            className="tg-field-error"
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.label>
  );
}

function Section({ id, n, title, subtitle, children }) {
  return (
    <motion.section
      id={id}
      className="tg-card"
      aria-labelledby={`${id}-title`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.05 * n }}
    >
      <h2 id={`${id}-title`}>
        <span className="tg-num">{n}</span>
        {title}
      </h2>
      <p className="tg-sub">{subtitle}</p>
      {children}
    </motion.section>
  );
}

function ChipField({ label, placeholder, items, onChange, className = "" }) {
  const id = useId();
  const [text, setText] = useState("");

  function add() {
    const v = text.trim();
    if (v && !items.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setText("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !text && items.length) {
      onChange(items.slice(0, -1));
    }
  }

  return (
    <div className={`tg-field ${className}`}>
      <label className="tg-label" htmlFor={id}>{label}</label>
      <div className="tg-chips">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.span
              key={item}
              className="tg-chip"
              layout
              initial={{ opacity: 0, scale: 0.6, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={SPRING}
            >
              {item}
              <button
                type="button"
                aria-label={`Remover ${item}`}
                onClick={() => onChange(items.filter((i) => i !== item))}
              >
                <X size={12} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <input
        id={id}
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
      />
    </div>
  );
}

/* Página */

export default function NovaTriagem() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addVisit } = useClinic();
  const [form, setForm] = useState(INITIAL);
  const [tried, setTried] = useState(false);
  const [protocolo] = useState(newProtocol);

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const onText = (name) => (e) => setField(name, e.target.value);
  const onMasked = (name, pattern) => (e) => setField(name, applyMask(e.target.value, pattern));
  const onDigits = (name, max) => (e) => setField(name, digits(e.target.value).slice(0, max));
  const onDecimal = (name) => (e) => {
    // só dígitos e um único separador decimal
    const raw = e.target.value.replace(/[^\d,.]/g, "").replace(".", ",");
    const [int, ...rest] = raw.split(",");
    const value = rest.length ? `${int},${rest.join("").slice(0, 2)}` : int;
    setField(name, value.slice(0, 6));
  };

  const imc = useMemo(() => {
    const kg = toNum(form.peso);
    const m = toNum(form.altura) / 100;
    return kg && m ? (kg / (m * m)).toFixed(1).replace(".", ",") : null;
  }, [form.peso, form.altura]);

  /* validação mínima por etapa */
  const nascimento = parseBrDate(form.nascimento);
  const inicio = parseBrDate(form.inicioSintomas);
  const today = startOfDay(new Date());

  const ok = {
    cpf: isValidCpf(form.cpf),
    nome: form.nome.trim().split(/\s+/).length >= 2,
    nascimento: isValidDate(form.nascimento),
    sexo: !!form.sexo,
    queixa: form.queixa.trim().length >= 3,
    // opcional, mas se preenchido precisa ser uma data válida, não futura e após o nascimento
    inicioSintomas:
      !form.inicioSintomas ||
      (!!inicio && inicio <= today && (!nascimento || inicio >= startOfDay(nascimento))),
    paSis: inRange(form.paSis, RANGES.paSis),
    paDia: inRange(form.paDia, RANGES.paDia) && toNum(form.paDia) < toNum(form.paSis),
    fc: inRange(form.fc, RANGES.fc),
    spo2: inRange(form.spo2, RANGES.spo2),
    temp: !form.temp || inRange(form.temp, RANGES.temp),
    peso: !form.peso || inRange(form.peso, RANGES.peso),
    altura: !form.altura || inRange(form.altura, RANGES.altura),
    risco: !!form.risco,
  };

  /* etapas = seções da página, na mesma ordem e numeração */
  const historicoFilled = form.alergias.length + form.comorbidades.length + form.medicamentos.length > 0;
  const stepDefs = [
    { n: 1, title: "Identificação", target: "tg-identificacao", ok: ok.cpf && ok.nome && ok.nascimento && ok.sexo },
    { n: 2, title: "Queixa principal", target: "tg-queixa", ok: ok.queixa && ok.inicioSintomas },
    { n: 3, title: "Histórico clínico", target: "tg-historico", ok: historicoFilled, optional: true },
    { n: 4, title: "Sinais vitais", target: "tg-sinais", ok: ok.paSis && ok.paDia && ok.fc && ok.spo2 && ok.temp && ok.peso && ok.altura },
    { n: 5, title: "Classificação de risco", target: "tg-triagem", ok: ok.risco },
    { n: 6, title: "Observação", target: "tg-observacao", ok: form.observacoes.trim().length > 0, optional: true },
  ];
  const required = stepDefs.filter((s) => !s.optional);
  const activeN = (required.find((s) => !s.ok) ?? stepDefs[5]).n;
  const status = (s) => (s.ok ? "done" : s.n === activeN ? "active" : s.optional ? "optional" : "pending");
  const STATUS_LABEL = { done: "Concluída", active: "Ativa", pending: "Pendente", optional: "Opcional" };

  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const bad = (key) => tried && !ok[key];

  const pharmacist = user?.name ?? "Farmacêutico(a) responsável";
  const crf = user?.crf ? ` (${user.crf})` : "";

  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setTried(true);
    const pending = required.find((s) => !s.ok);
    if (pending) return goTo(pending.target);

    // resumo dos sinais vitais no formato usado pela tabela de atendimentos
    const signs = [
      form.paSis && form.paDia && `PA ${form.paSis}/${form.paDia} mmHg`,
      form.fc && `FC ${form.fc} bpm`,
      form.spo2 && `SpO2 ${form.spo2}%`,
      form.temp && `Tax ${form.temp} °C`,
    ]
      .filter(Boolean)
      .join(" · ");

    setSaving(true);
    try {
      await addVisit({
      ...form,
      name: form.nome.trim(),
      // LGPD: no cliente fica só a forma anonimizada
      cpf: anonymizeCpf(form.cpf),
      complaint: form.queixa.trim(),
      signs,
      rt: pharmacist,
      protocol: protocolo,
      imc,
      status: "progress",
      urgent: ["laranja", "vermelho"].includes(form.risco) || form.redFlags.length > 0,
      });
      navigate("/dashboard");
    } catch {
      // o provider já avisou o usuário; o formulário fica preenchido para tentar de novo
      setSaving(false);
    }
  }

  const toggleFlag = (flag) =>
    setField(
      "redFlags",
      form.redFlags.includes(flag) ? form.redFlags.filter((f) => f !== flag) : [...form.redFlags, flag]
    );

  return (
    <form className="triagem" onSubmit={handleSubmit} noValidate>
      <motion.header
        className="tg-header"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div>
          <h1>Nova Triagem Clínica</h1>
          <p className="tg-sub">PROTOCOLO SES/DF · Registro de atendimento farmacêutico</p>
        </div>
        <div className="tg-badges">
          <span className="tg-badge tg-badge--ok">Em atendimento</span>
          <span className="tg-badge">{protocolo}</span>
        </div>
      </motion.header>

      <motion.nav
        className="tg-card"
        aria-label="Etapas do atendimento"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
      >
        <ol className="tg-steps">
          {stepDefs.map((s, i) => {
            const st = status(s);
            return (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.5, ease: EASE }}
              >
                <motion.button
                  type="button"
                  className={`tg-step tg-step--${st}`}
                  aria-current={st === "active" ? "step" : undefined}
                  onClick={() => goTo(s.target)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={st}
                      className="tg-step-dot"
                      initial={{ scale: 0.4, rotate: -40, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0.4, rotate: 40, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      {st === "done" ? <Check size={14} strokeWidth={3} /> : s.n}
                    </motion.span>
                  </AnimatePresence>
                  <span>
                    <span className="tg-step-state">Etapa {s.n} · {STATUS_LABEL[st]}</span>
                    <span className="tg-step-title">{s.title}</span>
                  </span>
                </motion.button>
              </motion.li>
            );
          })}
        </ol>
      </motion.nav>

      <Section id="tg-identificacao" n={1} title="Identificação do cidadão" subtitle="Dados básicos e documentos para abertura do atendimento">
        <div className="tg-grid tg-grid--3">
          <Field label="CPF" invalid={bad("cpf")} error="CPF inválido. Confira os 11 dígitos.">
            <input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={form.cpf}
              onChange={onMasked("cpf", "###.###.###-##")} aria-invalid={bad("cpf")} />
          </Field>
          <Field label="CNS / Cartão SUS">
            <input inputMode="numeric" placeholder="000 0000 0000 0000" value={form.cns}
              onChange={onDigits("cns", 15)} />
          </Field>
          <Field label="Nome completo" invalid={bad("nome")} error="Informe nome e sobrenome.">
            <input autoComplete="off" placeholder="Nome e sobrenome" value={form.nome}
              onChange={onText("nome")} aria-invalid={bad("nome")} />
          </Field>
          <Field label="Data de nascimento" invalid={bad("nascimento")} error="Informe uma data válida (dd/mm/aaaa).">
            <input inputMode="numeric" placeholder="dd/mm/aaaa" value={form.nascimento}
              onChange={onMasked("nascimento", "##/##/####")} aria-invalid={bad("nascimento")} />
          </Field>
          <Field label="Sexo" invalid={bad("sexo")} error="Selecione o sexo.">
            <select value={form.sexo} onChange={onText("sexo")} aria-invalid={bad("sexo")}>
              <option value="">Selecione uma opção</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </Field>
          <Field label="Telefone">
            <input type="tel" inputMode="numeric" placeholder="(61) 99999-0000" value={form.telefone}
              onChange={onMasked("telefone", "(##) #####-####")} />
          </Field>
        </div>
      </Section>

      <Section id="tg-queixa" n={2} title="Queixa principal" subtitle="Motivo informado pelo paciente">
        <div className="tg-grid">
          <Field label="Queixa principal" invalid={bad("queixa")} error="Descreva a queixa do paciente.">
            <input placeholder="Descreva a queixa relatada pelo paciente..." value={form.queixa}
              onChange={onText("queixa")} aria-invalid={bad("queixa")} />
          </Field>
          <div className="tg-grid tg-grid--2">
            <Field label="CID / CIAP-2">
              <input list="tg-codes" placeholder="Ex: CIAP-2 A03" value={form.codigo} onChange={onText("codigo")} />
              <datalist id="tg-codes">
                {CODE_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Início dos sintomas" invalid={bad("inicioSintomas")} error="Data inválida, futura ou anterior ao nascimento.">
              <input inputMode="numeric" placeholder="dd/mm/aaaa" value={form.inicioSintomas}
                onChange={onMasked("inicioSintomas", "##/##/####")} />
            </Field>
          </div>
        </div>
      </Section>

      <Section id="tg-historico" n={3} title="Histórico clínico" subtitle="Informações relevantes do atendimento">
        <div className="tg-grid">
          <div className="tg-grid tg-grid--2">
            <ChipField label="Alergia medicamentosa" placeholder="Pesquisar / adicionar..."
              items={form.alergias} onChange={(v) => setField("alergias", v)} />
            <ChipField label="Comorbidade" placeholder="Pesquisar / adicionar..."
              items={form.comorbidades} onChange={(v) => setField("comorbidades", v)} />
          </div>
          <ChipField label="Medicamento em uso" placeholder="Adicionar medicamento..."
            items={form.medicamentos} onChange={(v) => setField("medicamentos", v)} />
        </div>
      </Section>

      <Section id="tg-sinais" n={4} title="Sinais vitais e medidas" subtitle="Aferições realizadas durante o acolhimento farmacêutico">
        <div className="tg-grid tg-grid--3">
          <Field
            label="Pressão arterial"
            invalid={bad("paSis") || bad("paDia")}
            error={
              !inRange(form.paSis, RANGES.paSis)
                ? rangeMsg("Sistólica", RANGES.paSis, "mmHg")
                : !inRange(form.paDia, RANGES.paDia)
                ? rangeMsg("Diastólica", RANGES.paDia, "mmHg")
                : "Diastólica deve ser menor que a sistólica."
            }
            className="tg-vital"
          >
            <span className="tg-pa">
              <input inputMode="numeric" placeholder="120" aria-label="Pressão sistólica"
                value={form.paSis} onChange={onDigits("paSis", 3)} />
              <span aria-hidden="true">/</span>
              <input inputMode="numeric" placeholder="80" aria-label="Pressão diastólica"
                value={form.paDia} onChange={onDigits("paDia", 3)} />
            </span>
            <span className="tg-unit">mmHg</span>
          </Field>
          <Field label="Frequência cardíaca" invalid={bad("fc")} error={rangeMsg("FC", RANGES.fc, "bpm")} className="tg-vital">
            <input inputMode="numeric" placeholder="72" value={form.fc} onChange={onDigits("fc", 3)} />
            <span className="tg-unit">bpm</span>
          </Field>
          <Field label="SpO2" invalid={bad("spo2")} error={rangeMsg("SpO2", RANGES.spo2, "%")} className="tg-vital">
            <input inputMode="numeric" placeholder="98" value={form.spo2} onChange={onDigits("spo2", 3)} />
            <span className="tg-unit">%</span>
          </Field>
          <Field label="Temperatura" invalid={bad("temp")} error={rangeMsg("Temperatura", RANGES.temp, "°C")} className="tg-vital">
            <input inputMode="decimal" placeholder="36,5" value={form.temp} onChange={onDecimal("temp")} />
            <span className="tg-unit">°C</span>
          </Field>
          <Field label="Peso" invalid={bad("peso")} error={rangeMsg("Peso", RANGES.peso, "kg")} className="tg-vital">
            <input inputMode="decimal" placeholder="70" value={form.peso} onChange={onDecimal("peso")} />
            <span className="tg-unit">kg</span>
          </Field>
          <Field label="Altura" invalid={bad("altura")} error={rangeMsg("Altura", RANGES.altura, "cm")} className="tg-vital">
            <input inputMode="numeric" placeholder="170" value={form.altura} onChange={onDigits("altura", 3)} />
            <span className="tg-unit">cm</span>
          </Field>
          <div className="tg-field tg-vital tg-col-all">
            <span className="tg-label">IMC</span>
            <output className="tg-imc">{imc ?? "–"}</output>
            <span className="tg-unit">kg/m²</span>
          </div>
        </div>
      </Section>

      <Section id="tg-triagem" n={5} title="Triagem / classificação de risco" subtitle="Selecione a classificação observada">
        <fieldset className="tg-risk" aria-invalid={bad("risco")}>
          <legend className="tg-sr">Classificação de risco</legend>
          {RISK_LEVELS.map((r) => (
            <label key={r.id} className={`tg-risk-option tg-risk-option--${r.id}`}>
              <input type="radio" name="risco" value={r.id} checked={form.risco === r.id}
                onChange={onText("risco")} />
              <motion.span
                className="tg-risk-card"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                animate={form.risco === r.id ? { scale: 1.03 } : { scale: 1 }}
                transition={SPRING}
              >
                <span className="tg-risk-name"><i className="tg-dot" />{r.label}</span>
                <span className="tg-risk-hint">{r.hint}</span>
              </motion.span>
            </label>
          ))}
        </fieldset>
        <AnimatePresence>
          {bad("risco") && (
            <motion.p
              className="tg-error"
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              Selecione uma classificação de risco.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="tg-field tg-flags" role="group" aria-labelledby="tg-flags-label">
          <span id="tg-flags-label" className="tg-label">Red flags detectadas</span>
          {RED_FLAGS.map((flag) => (
            <label key={flag} className="tg-check">
              <input type="checkbox" checked={form.redFlags.includes(flag)} onChange={() => toggleFlag(flag)} />
              {flag}
            </label>
          ))}
        </div>
      </Section>

      <Section id="tg-observacao" n={6} title="Comentário / observação" subtitle="Registro livre do farmacêutico">
        <Field label="Observações do atendimento">
          <textarea rows={3} maxLength={OBS_LIMIT} value={form.observacoes} onChange={onText("observacoes")}
            placeholder="Digite informações adicionais, evolução ou observações..." />
        </Field>
        <p className="tg-counter">{form.observacoes.length} / {OBS_LIMIT} caracteres</p>
      </Section>

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
        <p>Certificação Digital ICP-Brasil habilitada · {pharmacist}{crf}</p>
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
