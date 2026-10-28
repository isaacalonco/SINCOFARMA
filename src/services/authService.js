// Login do painel. Com Cognito configurado (VITE_COGNITO_REGION e
// VITE_COGNITO_CLIENT_ID), autentica de verdade; sem ele, roda o modo
// demonstração com a senha fixa abaixo (nunca em produção).
import * as cognito from "./cognito";
import * as session from "./session";

export const AUTH_MODE = cognito.COGNITO_ENABLED ? "cognito" : "demo";
export { AuthError } from "./cognito";

const DEMO_PASSWORD = "12345678";
const DEMO_USER_KEY = "user";

export async function login(identifier, password) {
  if (AUTH_MODE === "cognito") {
    const tokens = await cognito.initiateAuth(identifier, password);
    return session.start(tokens);
  }
  await new Promise((r) => setTimeout(r, 600));
  if (password !== DEMO_PASSWORD) throw new Error("Credenciais inválidas.");
  const user = { name: "Dra. Ana Souza", crf: "CRF-DF 4192 · RT", onDuty: true };
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
export async function finishTotpSetup(setup, code) {
  const tokens = await cognito.finishTotpSetup(setup, code);
  return session.start(tokens);
}

/** Login com MFA: código de 6 dígitos do app autenticador. */
export async function answerTotp(challenge, code) {
  const tokens = await cognito.answerTotp(challenge, code);
  return session.start(tokens);
}

export function currentUser() {
  if (AUTH_MODE === "cognito") return session.storedUser();
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_USER_KEY));
    return saved && typeof saved === "object" && typeof saved.name === "string" ? saved : null;
  } catch {
    return null;
  }
}

export function logout() {
  if (AUTH_MODE === "cognito") session.end();
  ["token", DEMO_USER_KEY].forEach((k) => localStorage.removeItem(k));
}

export const getAccessToken = () => (AUTH_MODE === "cognito" ? session.getAccessToken() : Promise.resolve(null));
