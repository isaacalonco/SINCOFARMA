import { describe, expect, it } from "vitest";
import { pode, podeAlterar, podeRota, rotaInicial } from "./permissoes";
import { accessFrom } from "./session";

const farmaceutico = { roles: ["farmaceutico"], unit: "asa-sul" };
const medico = { roles: ["medico"], unit: null };
const admin = { roles: ["admin"], unit: null };
const rtAdmin = { roles: ["farmaceutico", "admin"], unit: "asa-sul" };

describe("papéis a partir dos grupos do Cognito", () => {
  it("separa papel e unidade", () => {
    expect(accessFrom(["unidade:asa-sul", "papel:farmaceutico", "papel:admin"])).toEqual({
      roles: ["farmaceutico", "admin"],
      unit: "asa-sul",
    });
  });

  it("sem grupos ou com duas unidades: sem unidade", () => {
    expect(accessFrom(undefined)).toEqual({ roles: [], unit: null });
    expect(accessFrom(["unidade:a", "unidade:b"]).unit).toBeNull();
  });
});

describe("o que cada perfil vê", () => {
  it("farmacêutico: painel, triagem e encaminhamentos da unidade", () => {
    expect(rotaInicial(farmaceutico)).toBe("/dashboard");
    expect(podeRota(farmaceutico, "/nova-triagem")).toBe(true);
    expect(podeRota(farmaceutico, "/encaminhamentos")).toBe(true);
    expect(podeRota(farmaceutico, "/farmacias")).toBe(false);
  });

  it("médico: só encaminhamentos", () => {
    expect(rotaInicial(medico)).toBe("/encaminhamentos");
    expect(podeRota(medico, "/dashboard")).toBe(false);
    expect(podeRota(medico, "/nova-triagem")).toBe(false);
    expect(pode(medico, "ver_atendimentos")).toBe(false);
  });

  it("administração: gestão, sem dados de paciente", () => {
    expect(rotaInicial(admin)).toBe("/farmacias");
    expect(podeRota(admin, "/dashboard")).toBe(false);
    expect(podeRota(admin, "/relatorios")).toBe(true);
    expect(pode(admin, "ver_atendimentos")).toBe(false);
  });

  it("papéis somam", () => {
    expect(podeRota(rtAdmin, "/dashboard")).toBe(true);
    expect(podeRota(rtAdmin, "/farmacias")).toBe(true);
  });

  it("sem papel: tela de sem acesso", () => {
    expect(rotaInicial({ roles: [], unit: "asa-sul" })).toBe("/sem-acesso");
    expect(podeRota(null, "/dashboard")).toBe(false);
  });

  it("permissão com nome errado falha alto", () => {
    expect(() => pode(farmaceutico, "ver_tudo")).toThrow(/desconhecida/);
  });
});

describe("alterar atendimento", () => {
  it("só quem registrou", () => {
    expect(podeAlterar(farmaceutico, { mine: true })).toBe(true);
    expect(podeAlterar(farmaceutico, { mine: false })).toBe(false);
    expect(podeAlterar(admin, { mine: true })).toBe(false);
  });

  it("modo demonstração (sem `mine`) segue o papel", () => {
    expect(podeAlterar(farmaceutico, {})).toBe(true);
  });
});
