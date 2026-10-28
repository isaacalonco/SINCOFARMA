// Seções do formulário. Cada uma recebe o estado e os manipuladores da página.
import { motion, AnimatePresence } from "framer-motion";
import { SPRING } from "../../utils/motion";
import { Field, FieldGroup, Section, ChipField } from "./fields";
import { RISK_LEVELS, RED_FLAGS, CODE_SUGGESTIONS, OBS_LIMIT, RANGES } from "./constants";
import { rangeMsg, paError } from "./validation";

export function IdentificacaoSection({ form, on, bad }) {
  return (
    <Section id="tg-identificacao" n={1} title="Identificação do cidadão" subtitle="Dados básicos e documentos para abertura do atendimento">
      <div className="tg-grid tg-grid--3">
        <Field label="CPF" invalid={bad("cpf")} error="CPF inválido. Confira os 11 dígitos.">
          <input inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={form.cpf}
            onChange={on.masked("cpf", "###.###.###-##")} />
        </Field>
        <Field label="CNS / Cartão SUS">
          <input inputMode="numeric" placeholder="000 0000 0000 0000" value={form.cns} onChange={on.digits("cns", 15)} />
        </Field>
        <Field label="Nome completo" invalid={bad("nome")} error="Informe nome e sobrenome.">
          <input autoComplete="off" placeholder="Nome e sobrenome" value={form.nome} onChange={on.text("nome")} />
        </Field>
        <Field label="Data de nascimento" invalid={bad("nascimento")} error="Informe uma data válida (dd/mm/aaaa).">
          <input inputMode="numeric" placeholder="dd/mm/aaaa" value={form.nascimento}
            onChange={on.masked("nascimento", "##/##/####")} />
        </Field>
        <Field label="Sexo" invalid={bad("sexo")} error="Selecione o sexo.">
          <select value={form.sexo} onChange={on.text("sexo")}>
            <option value="">Selecione uma opção</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </Field>
        <Field label="Telefone">
          <input type="tel" inputMode="numeric" placeholder="(61) 99999-0000" value={form.telefone}
            onChange={on.masked("telefone", "(##) #####-####")} />
        </Field>
      </div>
    </Section>
  );
}

export function QueixaSection({ form, on, bad }) {
  return (
    <Section id="tg-queixa" n={2} title="Queixa principal" subtitle="Motivo informado pelo paciente">
      <div className="tg-grid">
        <Field label="Queixa principal" invalid={bad("queixa")} error="Descreva a queixa do paciente.">
          <input placeholder="Descreva a queixa relatada pelo paciente..." value={form.queixa} onChange={on.text("queixa")} />
        </Field>
        <div className="tg-grid tg-grid--2">
          <Field label="CID / CIAP-2">
            <input list="tg-codes" placeholder="Ex: CIAP-2 A03" value={form.codigo} onChange={on.text("codigo")} />
            <datalist id="tg-codes">
              {CODE_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Início dos sintomas" invalid={bad("inicioSintomas")} error="Data inválida, futura ou anterior ao nascimento.">
            <input inputMode="numeric" placeholder="dd/mm/aaaa" value={form.inicioSintomas}
              onChange={on.masked("inicioSintomas", "##/##/####")} />
          </Field>
        </div>
      </div>
    </Section>
  );
}

export function HistoricoSection({ form, setField }) {
  return (
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
  );
}

function Vital({ label, field, unit, placeholder, form, on, bad, decimal = false, max = 3 }) {
  return (
    <Field label={label} invalid={bad(field)} error={rangeMsg(label === "Frequência cardíaca" ? "FC" : label, RANGES[field], unit)} className="tg-vital">
      <input inputMode={decimal ? "decimal" : "numeric"} placeholder={placeholder} value={form[field]}
        onChange={decimal ? on.decimal(field) : on.digits(field, max)} />
      <span className="tg-unit">{unit}</span>
    </Field>
  );
}

export function SinaisSection({ form, on, bad, imc }) {
  const p = { form, on, bad };
  return (
    <Section id="tg-sinais" n={4} title="Sinais vitais e medidas" subtitle="Aferições realizadas durante o acolhimento farmacêutico">
      <div className="tg-grid tg-grid--3">
        <FieldGroup label="Pressão arterial" invalid={bad("paSis") || bad("paDia")} error={paError(form)} className="tg-vital">
          <span className="tg-pa">
            <input inputMode="numeric" placeholder="120" aria-label="Pressão sistólica (mmHg)"
              aria-invalid={bad("paSis") || undefined} value={form.paSis} onChange={on.digits("paSis", 3)} />
            <span aria-hidden="true">/</span>
            <input inputMode="numeric" placeholder="80" aria-label="Pressão diastólica (mmHg)"
              aria-invalid={bad("paDia") || undefined} value={form.paDia} onChange={on.digits("paDia", 3)} />
          </span>
          <span className="tg-unit">mmHg</span>
        </FieldGroup>
        <Vital {...p} label="Frequência cardíaca" field="fc" unit="bpm" placeholder="72" />
        <Vital {...p} label="SpO2" field="spo2" unit="%" placeholder="98" />
        <Vital {...p} label="Temperatura" field="temp" unit="°C" placeholder="36,5" decimal />
        <Vital {...p} label="Peso" field="peso" unit="kg" placeholder="70" decimal />
        <Vital {...p} label="Altura" field="altura" unit="cm" placeholder="170" />
        <div className="tg-field tg-vital tg-col-all">
          <span className="tg-label" id="tg-imc-label">IMC</span>
          <output className="tg-imc" aria-labelledby="tg-imc-label" aria-live="polite">{imc ?? "–"}</output>
          <span className="tg-unit">kg/m²</span>
        </div>
      </div>
    </Section>
  );
}

export function RiscoSection({ form, on, bad, toggleFlag }) {
  const invalid = bad("risco");
  return (
    <Section id="tg-triagem" n={5} title="Triagem / classificação de risco" subtitle="Selecione a classificação observada">
      <fieldset className="tg-risk" aria-describedby={invalid ? "tg-risk-err" : undefined}>
        <legend className="sr-only">Classificação de risco</legend>
        {RISK_LEVELS.map((r) => (
          <label key={r.id} className={`tg-risk-option tg-risk-option--${r.id}`}>
            <input type="radio" name="risco" value={r.id} checked={form.risco === r.id}
              onChange={on.text("risco")} aria-describedby={`tg-risk-hint-${r.id}`} />
            <motion.span
              className="tg-risk-card"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              animate={form.risco === r.id ? { scale: 1.03 } : { scale: 1 }}
              transition={SPRING}
            >
              <span className="tg-risk-name"><i className="tg-dot" aria-hidden="true" />{r.label}</span>
              <span className="tg-risk-hint" id={`tg-risk-hint-${r.id}`}>{r.hint}</span>
            </motion.span>
          </label>
        ))}
      </fieldset>
      <AnimatePresence>
        {invalid && (
          <motion.p
            id="tg-risk-err"
            className="tg-error"
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
  );
}

export function ObservacaoSection({ form, on }) {
  return (
    <Section id="tg-observacao" n={6} title="Comentário / observação" subtitle="Registro livre do farmacêutico">
      <Field label="Observações do atendimento">
        <textarea rows={3} maxLength={OBS_LIMIT} value={form.observacoes} onChange={on.text("observacoes")}
          placeholder="Digite informações adicionais, evolução ou observações..." />
      </Field>
      <p className="tg-counter" aria-live="polite">{form.observacoes.length} / {OBS_LIMIT} caracteres</p>
    </Section>
  );
}
