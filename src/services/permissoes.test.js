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
    ["/dashboard", "/atendimentos", "/nova-triagem", "/encaminhamentos", "/farmacias", "/relatorios", "/usuarios", "/auditoria", "/privacidade-lgpd", "/ficha", "/minha-conta"].filter((p) =>
      podeRota(u, p)
    );

  it("farmacêutico: operação da farmácia, começando pelo Dashboard", () => {
    expect(paginas(farmaceutico)).toEqual(["/dashboard", "/atendimentos", "/nova-triagem", "/encaminhamentos", "/ficha", "/minha-conta"]);
    expect(rotaInicial(farmaceutico)).toBe("/dashboard");
  });

  it("médico: só encaminhamentos, que são o painel dele", () => {
    expect(paginas(medico)).toEqual(["/encaminhamentos", "/minha-conta"]);
    expect(rotaInicial(medico)).toBe("/encaminhamentos");
    expect(pode(medico, "ver_atendimentos")).toBe(false);
  });

  it("administração: telas de gestão, sem listas de pacientes nem triagem", () => {
    expect(paginas(admin)).toEqual(["/dashboard", "/farmacias", "/relatorios", "/usuarios", "/auditoria", "/privacidade-lgpd", "/minha-conta"]);
    expect(rotaInicial(admin)).toBe("/dashboard");
    expect(pode(admin, "ver_atendimentos")).toBe(false);
    expect(pode(admin, "criar_triagem")).toBe(false);
  });

  it("papéis somam", () => {
    expect(paginas(rtAdmin)).toHaveLength(11);
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

describe("LGPD", () => {
  it("todo perfil baixa os próprios dados e faz pedidos", () => {
    for (const u of [farmaceutico, medico, admin]) expect(pode(u, "exercer_direitos")).toBe(true);
  });

  it("só a administração atende pedidos e exporta dados de paciente", () => {
    expect(pode(admin, "atender_titulares")).toBe(true);
    expect(pode(farmaceutico, "atender_titulares")).toBe(false);
    expect(pode(medico, "atender_titulares")).toBe(false);
    expect(podeRota(farmaceutico, "/privacidade-lgpd")).toBe(false);
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
