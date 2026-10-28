// Regras de validação da triagem (funções puras, cobertas por testes).
import { parseBrDate, startOfDay } from "../../utils/dates";
import { isValidCpf } from "../../utils/cpf";
import { RANGES } from "./constants";

export const toNum = (v) => Number(String(v).replace(",", "."));

export const inRange = (v, [min, max]) => {
  const n = toNum(v);
  return v !== "" && Number.isFinite(n) && n >= min && n <= max;
};

export const rangeMsg = (label, [min, max], unit) => `${label} entre ${min} e ${max} ${unit}.`;

/** Data dd/mm/aaaa válida e não futura. */
export function isValidPastDate(masked, now = new Date()) {
  const d = parseBrDate(masked);
  return !!d && d <= now;
}

/** Mapa campo → válido. Campos opcionais valem quando vazios. */
export function validateTriage(form, now = new Date()) {
  const nascimento = parseBrDate(form.nascimento);
  const inicio = parseBrDate(form.inicioSintomas);
  const today = startOfDay(now);
  return {
    cpf: isValidCpf(form.cpf),
    nome: form.nome.trim().split(/\s+/).length >= 2,
    nascimento: isValidPastDate(form.nascimento, now),
    sexo: !!form.sexo,
    queixa: form.queixa.trim().length >= 3,
    // opcional; se preenchido: data válida, não futura e após o nascimento
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
}

/** Mensagem do campo de pressão arterial (sistólica, diastólica ou relação entre elas). */
export function paError(form) {
  if (!inRange(form.paSis, RANGES.paSis)) return rangeMsg("Sistólica", RANGES.paSis, "mmHg");
  if (!inRange(form.paDia, RANGES.paDia)) return rangeMsg("Diastólica", RANGES.paDia, "mmHg");
  return "Diastólica deve ser menor que a sistólica.";
}

/** Etapas = seções da página, na mesma ordem e numeração. */
export function buildSteps(form, ok) {
  const historicoFilled = form.alergias.length + form.comorbidades.length + form.medicamentos.length > 0;
  const steps = [
    { n: 1, title: "Identificação", target: "tg-identificacao", ok: ok.cpf && ok.nome && ok.nascimento && ok.sexo },
    { n: 2, title: "Queixa principal", target: "tg-queixa", ok: ok.queixa && ok.inicioSintomas },
    { n: 3, title: "Histórico clínico", target: "tg-historico", ok: historicoFilled, optional: true },
    { n: 4, title: "Sinais vitais", target: "tg-sinais", ok: ok.paSis && ok.paDia && ok.fc && ok.spo2 && ok.temp && ok.peso && ok.altura },
    { n: 5, title: "Classificação de risco", target: "tg-triagem", ok: ok.risco },
    { n: 6, title: "Observação", target: "tg-observacao", ok: form.observacoes.trim().length > 0, optional: true },
  ];
  const required = steps.filter((s) => !s.optional);
  const activeN = (required.find((s) => !s.ok) ?? steps[steps.length - 1]).n;
  return steps.map((s) => ({
    ...s,
    status: s.ok ? "done" : s.n === activeN ? "active" : s.optional ? "optional" : "pending",
  }));
}

/** Primeira etapa obrigatória incompleta (ou null). */
export const firstPending = (steps) => steps.find((s) => !s.optional && !s.ok) ?? null;
