// Sessão do Cognito no navegador.
// - token de acesso e de identidade: só em memória (somem ao recarregar);
// - refresh token e perfil: sessionStorage (somem ao fechar a aba);
// - nada vai para o localStorage.
import * as cognito from "./cognito";

const KEY = "sinco:session";

let access = null; // { token, exp }
let refreshing = null;

function decode(jwt) {
  try {
    const part = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

function readStored() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

/** Perfil exibido no painel, a partir do token de identidade. */
export function profileFrom(idToken) {
  const c = decode(idToken);
  return {
    name: c.name || c["cognito:username"] || "Farmacêutico(a)",
    crf: c["custom:crf"] ? `CRF-DF ${c["custom:crf"]} · RT` : undefined,
    sub: c.sub,
    ...accessFrom(c["cognito:groups"]),
  };
}

/** Papéis (`papel:*`) e unidade (`unidade:*`) a partir dos grupos do Cognito. */
export function accessFrom(groups) {
  const list = Array.isArray(groups) ? groups : [];
  const unidades = list.filter((g) => g.startsWith("unidade:")).map((g) => g.slice(8));
  return {
    roles: list.filter((g) => g.startsWith("papel:")).map((g) => g.slice(6)),
    unit: unidades.length === 1 ? unidades[0] : null,
  };
}

export function start(tokens) {
  const user = profileFrom(tokens.idToken);
  access = { token: tokens.accessToken, exp: decode(tokens.accessToken).exp * 1000 };
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ refreshToken: tokens.refreshToken, user }));
  } catch {
    /* modo privado sem armazenamento: a sessão dura só enquanto a página estiver aberta */
  }
  return user;
}

export function storedUser() {
  const user = readStored()?.user ?? null;
  // sessão de antes dos papéis: entra de novo para receber o perfil completo
  return user && Array.isArray(user.roles) ? user : null;
}

/** Token de acesso válido; renova pelo refresh token quando falta menos de 1 min. */
export async function getAccessToken() {
  if (access && access.exp - Date.now() > 60_000) return access.token;
  const stored = readStored();
  if (!stored?.refreshToken) return null;
  if (!refreshing) {
    refreshing = cognito
      .refresh(stored.refreshToken)
      .then((t) => {
        access = { token: t.accessToken, exp: decode(t.accessToken).exp * 1000 };
        return access.token;
      })
      .catch(() => {
        end();
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/** Encerra a sessão local e revoga o refresh token no Cognito (melhor esforço). */
export function end() {
  const stored = readStored();
  access = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
  if (stored?.refreshToken) cognito.revoke(stored.refreshToken).catch(() => {});
}
