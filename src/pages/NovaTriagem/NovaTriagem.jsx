import { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useClinic } from "../../contexts/clinic";
import { EASE } from "../../utils/motion";
import "./NovaTriagem.css";

/* ---------- constantes ---------- */

const RISK_LEVELS = [
  { id: "azul", label: "Azul", hint: "Não urgente" },
  { id: "verde", label: "Verde", hint: "Pouco urgente" },
  { id: "amarelo", label: "Amarelo", hint: "Urgente" },
  { id: "laranja", label: "Laranja", hint: "Muito urgente" },
  { id: "vermelho", label: "Vermelho", hint: "Imediato" },
];

const RED_FLAGS = ["Dor torácica", "Dispneia", "Déficit neurológico", "Síncope"];

// Exemplo curto, só para o campo "Buscar código". Troque por uma busca real.
const CODE_SUGGESTIONS = [
  "CIAP-2 A03 · Febre",
  "CIAP-2 N01 · Cefaleia",
  "CIAP-2 R05 · Tosse",
  "CIAP-2 R02 · Dispneia",
  "CID-10 R07.4 · Dor torácica não especificada",
];

const OBS_LIMIT = 500;

const INITIAL = {
  cpf: "", cns: "", nome: "", nascimento: "", sexo: "", telefone: "",
  queixa: "", codigo: "", inicioSintomas: "",
  alergias: [], comorbidades: [], medicamentos: [],
  paSis: "", paDia: "", fc: "", spo2: "", temp: "", peso: "", altura: "",
  risco: "", redFlags: [], observacoes: "",
};

/* ---------- utilitários ---------- */

const digits = (v) => v.replace(/\D/g, "");
const toNum = (v) => Number(String(v).replace(",", "."));

// "#" = dígito. Não deixa separador sobrando no fim.
function applyMask(value, pattern) {
  const d = digits(value);
  let out = "";
  let i = 0;
  for (const ch of pattern) {
    if (i >= d.length) break;
    out += ch === "#" ? d[i++] : ch;
  }
  return out;
}

function isValidCpf(masked) {
  const d = digits(masked);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const check = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

function isValidDate(masked) {
  if (masked.length !== 10) return false;
  const [dd, mm, yyyy] = masked.split("/").map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return (
    date.getFullYear() === yyyy &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd &&
    date <= new Date()
  );
}

// Placeholder: o número real do protocolo deve vir do backend.
const newProtocol = () =>
  `SIN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;

/* ---------- componentes pequenos ---------- */

function Field({ label, invalid, error, className = "", children }) {
  return (
    <label className={`tg-field ${invalid ? "is-invalid" : ""} ${className}`}>
      <span className="tg-label">{label}</span>
      {children}
      {invalid && error && <span className="tg-field-error" role="alert">{error}</span>}
    </label>
  );
}

function Section({ id, n, title, subtitle, children }) {
  return (
    <section id={id} className="tg-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{n}. {title}</h2>
      <p className="tg-sub">{subtitle}</p>
      {children}
    </section>
  );
}

// Campo de lista: digite e pressione Enter para adicionar; Backspace remove o último.
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
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: EASE }}
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

/* ---------- página ---------- */

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
  const onDecimal = (name) => (e) => setField(name, e.target.value.replace(/[^\d,.]/g, "").slice(0, 5));

  const imc = useMemo(() => {
    const kg = toNum(form.peso);
    const m = toNum(form.altura) / 100;
    return kg && m ? (kg / (m * m)).toFixed(1).replace(".", ",") : null;
  }, [form.peso, form.altura]);

  /* validação mínima por etapa */
  const ok = {
    cpf: isValidCpf(form.cpf),
    nome: form.nome.trim().split(/\s+/).length >= 2,
    nascimento: isValidDate(form.nascimento),
    sexo: !!form.sexo,
    queixa: form.queixa.trim().length >= 3,
    paSis: toNum(form.paSis) > 0,
    paDia: toNum(form.paDia) > 0,
    fc: toNum(form.fc) > 0,
    spo2: toNum(form.spo2) > 0,
    risco: !!form.risco,
  };

  const stepDefs = [
    { n: 1, title: "Identificação do Cidadão", target: "tg-identificacao", ok: ok.cpf && ok.nome && ok.nascimento && ok.sexo },
    { n: 2, title: "Queixa & Histórico", target: "tg-queixa", ok: ok.queixa },
    { n: 3, title: "Sinais Vitais", target: "tg-sinais", ok: ok.paSis && ok.paDia && ok.fc && ok.spo2 },
    { n: 4, title: "Triagem", target: "tg-triagem", ok: ok.risco },
    { n: 5, title: "Conduta", target: "tg-triagem", ok: ok.risco },
    { n: 6, title: "Observação", target: "tg-observacao", ok: false },
  ];
  const activeN = (stepDefs.find((s) => !s.ok) ?? stepDefs[5]).n;
  const status = (s) => (s.ok ? "done" : s.n === activeN ? "active" : "pending");
  const STATUS_LABEL = { done: "Concluída", active: "Ativa", pending: "Pendente" };

  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const bad = (key) => tried && !ok[key];

  function handleSubmit(e) {
    e.preventDefault();
    setTried(true);
    const pending = stepDefs.find((s) => s.n < 6 && !s.ok);
    if (pending) return goTo(pending.target);

    // O addVisit já completa id e horário e mostra o toast "Triagem de X registrada".
    // Se as chaves abaixo diferirem das de seedVisits (Dashboard/data), ajuste aqui.
    addVisit({
      ...form,
      name: form.nome.trim(),
      protocol: protocolo,
      imc,
      status: "progress",
      urgent: ["laranja", "vermelho"].includes(form.risco),
    });
    navigate("/dashboard");
  }

  const toggleFlag = (flag) =>
    setField(
      "redFlags",
      form.redFlags.includes(flag) ? form.redFlags.filter((f) => f !== flag) : [...form.redFlags, flag]
    );

  // Ajuste os nomes dos campos conforme o objeto "user" do seu AuthContext.
  const pharmacist = user?.name ?? "Farmacêutico(a) responsável";
  const crf = user?.crf ? ` (${user.crf})` : "";

  return (
    <form className="triagem" onSubmit={handleSubmit} noValidate>
      <header className="tg-header">
        <div>
          <h1>Nova Triagem Clínica</h1>
          <p className="tg-sub">PROTOCOLO SES/DF · Registro de atendimento farmacêutico</p>
        </div>
        <div className="tg-badges">
          <span className="tg-badge tg-badge--ok">Em atendimento</span>
          <span className="tg-badge">{protocolo}</span>
        </div>
      </header>

      <nav className="tg-card" aria-label="Etapas do atendimento">
        <ol className="tg-steps">
          {stepDefs.map((s) => {
            const st = status(s);
            return (
              <li key={s.n}>
                <button
                  type="button"
                  className={`tg-step tg-step--${st}`}
                  aria-current={st === "active" ? "step" : undefined}
                  onClick={() => goTo(s.target)}
                >
                  <span className="tg-step-dot">
                    {st === "done" ? <Check size={14} strokeWidth={3} /> : s.n}
                  </span>
                  <span>
                    <span className="tg-step-state">Etapa {s.n} · {STATUS_LABEL[st]}</span>
                    <span className="tg-step-title">{s.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Section id="tg-identificacao" n={1} title="Identificação do cidadão" subtitle="Dados básicos e documentos para abertura do atendimento">
        <div className="tg-grid tg-grid--3">
          <Field label="CPF" invalid={bad("cpf")} error="CPF inválido. Confira os 11 dígitos.">
            <input inputMode="numeric" autoComplete="off" placeholder="___.___.___-__" value={form.cpf}
              onChange={onMasked("cpf", "###.###.###-##")} aria-invalid={bad("cpf")} />
          </Field>
          <Field label="CNS / Cartão SUS">
            <input inputMode="numeric" placeholder="_______________" value={form.cns}
              onChange={onDigits("cns", 15)} />
          </Field>
          <Field label="Nome completo" invalid={bad("nome")} error="Informe nome e sobrenome.">
            <input autoComplete="off" placeholder="Nome e sobrenome" value={form.nome}
              onChange={onText("nome")} aria-invalid={bad("nome")} />
          </Field>
          <Field label="Data de nascimento" invalid={bad("nascimento")} error="Informe uma data válida (dd/mm/aaaa).">
            <input inputMode="numeric" placeholder="__/__/____" value={form.nascimento}
              onChange={onMasked("nascimento", "##/##/####")} aria-invalid={bad("nascimento")} />
          </Field>
          <Field label="Sexo" invalid={bad("sexo")} error="Selecione o sexo.">
            <select value={form.sexo} onChange={onText("sexo")} aria-invalid={bad("sexo")}>
              <option value="">Selecione</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </Field>
          <Field label="Telefone">
            <input type="tel" inputMode="numeric" placeholder="(__) _____-____" value={form.telefone}
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
              <input list="tg-codes" placeholder="Buscar código" value={form.codigo} onChange={onText("codigo")} />
              <datalist id="tg-codes">
                {CODE_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Início dos sintomas">
              <input inputMode="numeric" placeholder="__/__/____" value={form.inicioSintomas}
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
          <Field label="Pressão arterial" invalid={bad("paSis") || bad("paDia")} error="Informe sistólica e diastólica." className="tg-vital">
            <span className="tg-pa">
              <input inputMode="numeric" placeholder="---" aria-label="Pressão sistólica"
                value={form.paSis} onChange={onDigits("paSis", 3)} />
              <span aria-hidden="true">/</span>
              <input inputMode="numeric" placeholder="---" aria-label="Pressão diastólica"
                value={form.paDia} onChange={onDigits("paDia", 3)} />
            </span>
            <span className="tg-unit">mmHg</span>
          </Field>
          <Field label="Frequência cardíaca" invalid={bad("fc")} error="Obrigatório." className="tg-vital">
            <input inputMode="numeric" placeholder="---" value={form.fc} onChange={onDigits("fc", 3)} />
            <span className="tg-unit">bpm</span>
          </Field>
          <Field label="SpO2" invalid={bad("spo2")} error="Obrigatório." className="tg-vital">
            <input inputMode="numeric" placeholder="---" value={form.spo2} onChange={onDigits("spo2", 3)} />
            <span className="tg-unit">%</span>
          </Field>
          <Field label="Temperatura" className="tg-vital">
            <input inputMode="decimal" placeholder="---" value={form.temp} onChange={onDecimal("temp")} />
            <span className="tg-unit">°C</span>
          </Field>
          <Field label="Peso" className="tg-vital">
            <input inputMode="decimal" placeholder="---" value={form.peso} onChange={onDecimal("peso")} />
            <span className="tg-unit">kg</span>
          </Field>
          <Field label="Altura" className="tg-vital">
            <input inputMode="numeric" placeholder="---" value={form.altura} onChange={onDigits("altura", 3)} />
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
              <span className="tg-risk-card">
                <span className="tg-risk-name"><i className="tg-dot" />{r.label}</span>
                <span className="tg-risk-hint">{r.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {bad("risco") && <p className="tg-error" role="alert">Selecione uma classificação de risco.</p>}

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

      <footer className="tg-footer">
        <button type="button" className="tg-btn tg-btn--ghost" onClick={() => navigate(-1)}>
          Cancelar
        </button>
        <p>Certificação Digital ICP-Brasil habilitada · {pharmacist}{crf}</p>
        <motion.button type="submit" className="tg-btn tg-btn--primary" whileTap={{ scale: 0.97 }}>
          Continuar
        </motion.button>
      </footer>
    </form>
  );
}
