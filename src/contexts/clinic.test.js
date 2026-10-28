import { describe, it, expect } from "vitest";
import { matchesQuery, normalize } from "./clinic";

const visit = {
  name: "João Carlos Pereira",
  cpf: "***.***.***-55",
  complaint: "Dor torácica e Falta de ar",
  signs: "PA 170/110 mmHg · SpO2 94%",
  rt: "Dra. Ana Souza",
  time: "10:15",
};

describe("busca", () => {
  it("normaliza acentos e caixa", () => {
    expect(normalize("Ação Ú")).toBe("acao u");
  });
  it("encontra por nome, CPF, queixa, sinais, RT e horário, sem acentos", () => {
    for (const q of ["joao", "pereira", "-55", "toracica", "spo2", "souza", "10:15"]) {
      expect(matchesQuery(visit, q)).toBe(true);
    }
  });
  it("texto vazio casa com tudo; termo ausente não casa", () => {
    expect(matchesQuery(visit, "   ")).toBe(true);
    expect(matchesQuery(visit, "mariana")).toBe(false);
  });
});
