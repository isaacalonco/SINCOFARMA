// Login do painel. Com Cognito configurado (VITE_COGNITO_REGION e
// VITE_COGNITO_CLIENT_ID), autentica de verdade; sem ele, roda o modo
// demonstração com a senha fixa abaixo (nunca em produção).
import * as cognito from "./cognito";
import * as session from "./session";
import * as device from "./device";

export const AUTH_MODE = cognito.COGNITO_ENABLED ? "cognito" : "demo";
export { AuthError } from "./cognito";

const DEMO_PASSWORD = "12345678";
const DEMO_USER_KEY = "user";
// a demonstração mostra a visão do farmacêutico
const DEMO_ACCESS = { roles: ["farmaceutico"], unit: "demo" };

export async function login(identifier, password) {
  if (AUTH_MODE === "cognito") {
    const tokens = await cognito.initiateAuth(identifier, password);
    return session.start(tokens);
  }
  await new Promise((r) => setTimeout(r, 600));
  if (password !== DEMO_PASSWORD) throw new Error("Credenciais inválidas.");
  const user = { name: "Dra. Ana Souza", crf: "CRF-DF 4192 · RT", onDuty: true, ...DEMO_ACCESS };
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  localStorage.setItem("token", "demo");
  return user;
}

/** Primeiro acesso no Cognito: define a senha definitiva e entra. */
export async function completeNewPassword(challenge, newPassword) {
  const tokens = await cognito.completeNewPassword(challenge, newPassword);
  return session.start(tokens);
}

/** MFA obrigatório, primeiro login: segredo para o app autenticador. */
export const startTotpSetup = (challenge) => cognito.startTotpSetup(challenge);

/** Confere o primeiro código do app autenticador e entra. */
export async function finishTotpSetup(setup, code, trust = false) {
  const tokens = await cognito.finishTotpSetup(setup, code, trust);
  return session.start(tokens);
}

/** Login com MFA: código de 6 dígitos do app autenticador. */
export async function answerTotp(challenge, code, trust = false) {
  const tokens = await cognito.answerTotp(challenge, code, trust);
  return session.start(tokens);
}

export function currentUser() {
  if (AUTH_MODE === "cognito") return session.storedUser();
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_USER_KEY));
    return saved && typeof saved === "object" && typeof saved.name === "string" ? { ...saved, ...DEMO_ACCESS } : null;
  } catch {
    return null;
  }
}

export function logout() {
  if (AUTH_MODE === "cognito") session.end();
  ["token", DEMO_USER_KEY].forEach((k) => localStorage.removeItem(k));
}

export const getAccessToken = () => (AUTH_MODE === "cognito" ? session.getAccessToken() : Promise.resolve(null));

/* ---------- Minha conta (Cognito com o token da própria pessoa) ---------- */

const DEMO_BLOCK = () => Promise.reject(new Error("Indisponível na demonstração."));

async function withToken(fn) {
  const token = await session.getAccessToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  return fn(token);
}

export const account = {
  details: () => (AUTH_MODE === "cognito" ? withToken(cognito.getUser) : Promise.resolve({ email: "ana@exemplo.com.br" })),
  changePassword: (previous, proposed) =>
    AUTH_MODE === "cognito" ? withToken((t) => cognito.changePassword(t, previous, proposed)) : DEMO_BLOCK(),
  startTotpChange: () => (AUTH_MODE === "cognito" ? withToken(cognito.startTotpChange) : DEMO_BLOCK()),
  finishTotpChange: (code) => (AUTH_MODE === "cognito" ? withToken((t) => cognito.finishTotpChange(t, code)) : DEMO_BLOCK()),
  /** Encerra em todos os aparelhos; depois disso esta aba também sai. */
  // também deixa de confiar neste computador (o código volta a ser pedido)
  signOutEverywhere: () =>
    AUTH_MODE === "cognito" ? withToken(cognito.globalSignOut).then(device.forgetAll) : Promise.resolve(),
  forgotPassword: (identifier) => (AUTH_MODE === "cognito" ? cognito.forgotPassword(identifier) : DEMO_BLOCK()),
  confirmForgotPassword: (identifier, code, password) =>
    AUTH_MODE === "cognito" ? cognito.confirmForgotPassword(identifier, code, password) : DEMO_BLOCK(),
};
