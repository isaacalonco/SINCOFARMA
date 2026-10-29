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
  const paginas = (u) =>
    ["/dashboard", "/atendimentos", "/nova-triagem", "/encaminhamentos", "/farmacias", "/relatorios"].filter((p) => podeRota(u, p));

  it("farmacêutico: atendimentos, nova triagem e encaminhamentos", () => {
    expect(paginas(farmaceutico)).toEqual(["/atendimentos", "/nova-triagem", "/encaminhamentos"]);
    expect(rotaInicial(farmaceutico)).toBe("/atendimentos");
  });

  it("médico: só encaminhamentos", () => {
    expect(paginas(medico)).toEqual(["/encaminhamentos"]);
    expect(rotaInicial(medico)).toBe("/encaminhamentos");
    expect(pode(medico, "ver_atendimentos")).toBe(false);
  });

  it("administração: todas as páginas, mas sem dados de paciente nem registro", () => {
    expect(paginas(admin)).toHaveLength(6);
    expect(rotaInicial(admin)).toBe("/dashboard");
    expect(pode(admin, "ver_atendimentos")).toBe(false);
    expect(pode(admin, "criar_triagem")).toBe(false);
  });

  it("papéis somam", () => {
    expect(paginas(rtAdmin)).toHaveLength(6);
    expect(pode(rtAdmin, "criar_triagem")).toBe(true);
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
