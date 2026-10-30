// Configuração do que está disponível no app. Um lugar só para ligar/desligar.
import { HAS_API } from "../data";

/** Rotas com página funcional. As demais mostram "Módulo em construção". */
export const ROUTES_READY = new Set(["/dashboard", "/nova-triagem", "/usuarios", "/minha-conta", "/auditoria", "/privacidade-lgpd"]);
export const isReady = (path) => ROUTES_READY.has(path);

/**
 * Selos de conformidade exibidos no login. Só ligar quando houver
 * implementação e validação reais (certificado ICP-Brasil, relatório LGPD).
 */
export const COMPLIANCE = {
  icpBrasil: false,
  lgpd: false,
};

/**
 * Política de privacidade (LGPD, art. 9º e 41). O encarregado de dados ainda não foi
 * nomeado: defina VITE_DPO_NOME e VITE_DPO_EMAIL na Vercel quando o Sincofarma nomear.
 */
export const PRIVACIDADE = {
  controlador: "Sincofarma DF — Sindicato do Comércio Varejista de Produtos Farmacêuticos do Distrito Federal",
  encarregado: {
    nome: import.meta.env.VITE_DPO_NOME || null,
    email: import.meta.env.VITE_DPO_EMAIL || null,
  },
  atualizadaEm: "2026-10-29",
};

/** Minutos sem atividade até encerrar a sessão (computador compartilhado de balcão). */
export const IDLE_MINUTES = Number(import.meta.env.VITE_IDLE_MINUTES) || 15;
export const IDLE_WARN_MS = 60 * 1000;

/** Em desenvolvimento, `localStorage["sinco:idle-ms"]` encurta o tempo para testes. */
export function idleTimeoutMs() {
  if (import.meta.env.DEV) {
    try {
      const override = Number(localStorage.getItem("sinco:idle-ms"));
      if (override > 0) return override;
    } catch {
      /* ignora */
    }
  }
  return IDLE_MINUTES * 60 * 1000;
}

/** Sem API configurada, o app roda com dados fictícios no navegador. */
export const DEMO_MODE = !HAS_API;
