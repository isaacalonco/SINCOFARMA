import { describe, it, expect } from "vitest";
import { validateTriage, buildSteps, firstPending, paError, inRange } from "./validation";
import { buildTriageRecord, computeImc, formatSigns } from "./record";
import { INITIAL } from "./constants";

const now = new Date(2026, 9, 28, 12, 0);
const valid = {
  ...INITIAL,
  cpf: "529.982.247-25",
  nome: "Maria Teste",
  nascimento: "10/05/1990",
  sexo: "F",
  queixa: "Tosse seca",
  paSis: "120",
  paDia: "80",
  fc: "72",
  spo2: "98",
  risco: "azul",
};

describe("validateTriage", () => {
  it("formulário mínimo completo é válido", () => {
    const ok = validateTriage(valid, now);
    expect(Object.values(ok).every(Boolean)).toBe(true);
  });

  it("recusa sinais vitais fora da faixa e diastólica >= sistólica", () => {
    expect(validateTriage({ ...valid, spo2: "999" }, now).spo2).toBe(false);
    expect(validateTriage({ ...valid, paSis: "300" }, now).paSis).toBe(false);
    expect(validateTriage({ ...valid, paDia: "130" }, now).paDia).toBe(false);
    expect(validateTriage({ ...valid, temp: "3,7" }, now).temp).toBe(false);
    expect(validateTriage({ ...valid, temp: "" }, now).temp).toBe(true); // opcional
  });

  it("campo vazio não conta como zero dentro da faixa", () => {
    expect(inRange("", [0, 10])).toBe(false);
  });

  it("início dos sintomas: opcional, não futuro, não antes do nascimento", () => {
    expect(validateTriage({ ...valid, inicioSintomas: "" }, now).inicioSintomas).toBe(true);
    expect(validateTriage({ ...valid, inicioSintomas: "01/01/2099" }, now).inicioSintomas).toBe(false);
    expect(validateTriage({ ...valid, inicioSintomas: "01/01/1980" }, now).inicioSintomas).toBe(false);
    expect(validateTriage({ ...valid, inicioSintomas: "20/10/2026" }, now).inicioSintomas).toBe(true);
  });

  it("explica o erro de pressão arterial", () => {
    expect(paError({ paSis: "300", paDia: "80" })).toMatch(/Sistólica/);
    expect(paError({ paSis: "120", paDia: "10" })).toMatch(/Diastólica entre/);
    expect(paError({ paSis: "120", paDia: "130" })).toMatch(/menor que a sistólica/);
  });
});

describe("buildSteps", () => {
  it("vazio: etapa 1 ativa, opcionais marcadas como opcionais", () => {
    const steps = buildSteps(INITIAL, validateTriage(INITIAL, now));
    expect(steps.map((s) => s.status)).toEqual(["active", "pending", "optional", "pending", "pending", "optional"]);
    expect(firstPending(steps).target).toBe("tg-identificacao");
  });

  it("completo: obrigatórias concluídas, nada pendente", () => {
    const steps = buildSteps(valid, validateTriage(valid, now));
    expect(steps.filter((s) => !s.optional).every((s) => s.status === "done")).toBe(true);
    expect(firstPending(steps)).toBeNull();
  });
});

describe("buildTriageRecord", () => {
  it("o resumo não carrega dados pessoais nem clínicos completos", () => {
    const form = { ...valid, telefone: "(61) 99999-0000", cns: "123456789012345", alergias: ["Dipirona"], observacoes: "x" };
    const { summary, clinical } = buildTriageRecord(form, { pharmacist: "Dra. Ana", protocol: "SIN-1" });
    expect(summary.cpf).toBe("***.***.***-25");
    for (const key of ["telefone", "cns", "nascimento", "alergias", "observacoes", "phone", "birthDate", "history", "notes"]) {
      expect(summary).not.toHaveProperty(key);
    }
    expect(JSON.stringify(summary)).not.toContain("99999");
    expect(JSON.stringify(summary)).not.toContain("Dipirona");
    expect(clinical.patient.cpf).toBe("52998224725");
    expect(clinical.patient.phone).toBe("61999990000");
    expect(clinical.history.allergies).toEqual(["Dipirona"]);
  });

  it("red flag ou risco laranja/vermelho marcam urgência", () => {
    const opts = { pharmacist: "A", protocol: "P" };
    expect(buildTriageRecord(valid, opts).summary.urgent).toBe(false);
    expect(buildTriageRecord({ ...valid, risco: "laranja" }, opts).summary.urgent).toBe(true);
    expect(buildTriageRecord({ ...valid, redFlags: ["Síncope"] }, opts).summary.urgent).toBe(true);
  });

  it("formata sinais e IMC", () => {
    expect(formatSigns({ paSis: "120", paDia: "80", fc: "72", spo2: "", temp: "36,5" })).toBe("PA 120/80 mmHg · FC 72 bpm · Tax 36,5 °C");
    expect(computeImc("70", "175")).toBe("22,9");
    expect(computeImc("", "175")).toBeNull();
  });
});
