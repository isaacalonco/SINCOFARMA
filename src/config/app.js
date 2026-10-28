// Configuração do que está disponível no app. Um lugar só para ligar/desligar.
import { HAS_API } from "../data";

/** Rotas com página funcional. As demais mostram "Módulo em construção". */
export const ROUTES_READY = new Set(["/dashboard", "/nova-triagem"]);
export const isReady = (path) => ROUTES_READY.has(path);

/**
 * Selos de conformidade exibidos no login. Só ligar quando houver
 * implementação e validação reais (certificado ICP-Brasil, relatório LGPD).
 */
export const COMPLIANCE = {
  icpBrasil: false,
  lgpd: false,
};

/** Sem API configurada, o app roda com dados fictícios no navegador. */
export const DEMO_MODE = !HAS_API;
