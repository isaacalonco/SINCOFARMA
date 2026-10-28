// Monta o registro da triagem a partir do formulário.
//
// Separa em duas partes (minimização de dados, LGPD):
//  - summary: o mínimo para listar o atendimento no painel. É o que pode
//    ficar em cache no navegador.
//  - clinical: dados pessoais e clínicos completos. Só vão para o servidor;
//    o repositório simulado descarta esta parte.
import { anonymizeCpf, digits } from "../../utils/cpf";
import { toNum } from "./validation";
import { URGENT_RISKS } from "./constants";

export function computeImc(peso, alturaCm) {
  const kg = toNum(peso);
  const m = toNum(alturaCm) / 100;
  if (!kg || !m || !Number.isFinite(kg) || !Number.isFinite(m)) return null;
  return (kg / (m * m)).toFixed(1).replace(".", ",");
}

/** "PA 120/80 mmHg · FC 72 bpm · SpO2 98% · Tax 36,5 °C" (só o que foi aferido). */
export function formatSigns(form) {
  return [
    form.paSis && form.paDia && `PA ${form.paSis}/${form.paDia} mmHg`,
    form.fc && `FC ${form.fc} bpm`,
    form.spo2 && `SpO2 ${form.spo2}%`,
    form.temp && `Tax ${form.temp} °C`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildTriageRecord(form, { pharmacist, protocol }) {
  const urgent = URGENT_RISKS.has(form.risco) || form.redFlags.length > 0;

  const summary = {
    name: form.nome.trim().replace(/\s+/g, " "),
    cpf: anonymizeCpf(form.cpf),
    complaint: form.queixa.trim(),
    signs: formatSigns(form),
    rt: pharmacist,
    protocol,
    risk: form.risco,
    redFlags: [...form.redFlags],
    status: "progress",
    urgent,
  };

  const clinical = {
    patient: {
      cpf: digits(form.cpf),
      cns: digits(form.cns) || null,
      name: summary.name,
      birthDate: form.nascimento,
      sex: form.sexo,
      phone: digits(form.telefone) || null,
    },
    complaint: {
      text: summary.complaint,
      code: form.codigo.trim() || null,
      onset: form.inicioSintomas || null,
    },
    history: {
      allergies: [...form.alergias],
      comorbidities: [...form.comorbidades],
      medications: [...form.medicamentos],
    },
    vitals: {
      systolic: toNum(form.paSis),
      diastolic: toNum(form.paDia),
      heartRate: toNum(form.fc),
      spo2: toNum(form.spo2),
      temperature: form.temp ? toNum(form.temp) : null,
      weightKg: form.peso ? toNum(form.peso) : null,
      heightCm: form.altura ? toNum(form.altura) : null,
      bmi: computeImc(form.peso, form.altura),
    },
    risk: form.risco,
    redFlags: [...form.redFlags],
    notes: form.observacoes.trim() || null,
  };

  return { summary, clinical };
}
