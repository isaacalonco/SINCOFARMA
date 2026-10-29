// "Confiar neste computador por 24 h": aparelho lembrado do Cognito.
// Num aparelho lembrado, o login pede a senha e, no lugar do código do app
// autenticador, o navegador prova com uma chave própria (SRP) que é o mesmo aparelho.
// - A conta SRP vem da biblioteca oficial da AWS (amazon-cognito-identity-js),
//   na mesma sequência que ela usa; aqui só a orquestração.
// - O prazo é do painel (o Cognito não expira sozinho): depois de 24 h o aparelho
//   deixa de ser usado aqui, e uma tarefa no backend o esquece também no Cognito.
import { Buffer } from "buffer";
import AuthenticationHelper from "amazon-cognito-identity-js/es/AuthenticationHelper";
import DateHelper from "amazon-cognito-identity-js/es/DateHelper";
import BigInteger from "amazon-cognito-identity-js/es/BigInteger";

export const TRUST_MS = 24 * 60 * 60 * 1000;
const KEY = (username) => `sinco:device:${username}`;

function read(username) {
  try {
    return JSON.parse(localStorage.getItem(KEY(username))) || null;
  } catch {
    return null;
  }
}

/** Aparelho lembrado ainda dentro das 24 h (ou null). */
export function trusted(username, now = Date.now()) {
  const d = read(username);
  return d && d.until > now ? d : null;
}

/** Aparelho que passou do prazo: some daqui (o backend o esquece no Cognito). */
export function expired(username, now = Date.now()) {
  const d = read(username);
  return d && d.until <= now ? d : null;
}

export function forget(username) {
  try {
    localStorage.removeItem(KEY(username));
  } catch {
    /* ignora */
  }
}

/** Esquece todos os aparelhos lembrados deste navegador ("sair de todos os aparelhos"). */
export function forgetAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sinco:device:"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignora */
  }
}

function save(usernames, record) {
  for (const u of new Set(usernames.filter(Boolean))) {
    try {
      localStorage.setItem(KEY(u), JSON.stringify(record));
    } catch {
      /* sem armazenamento: o aparelho não fica lembrado */
    }
  }
}

const callbackToPromise = (fn) =>
  new Promise((resolve, reject) => fn((err, value) => (err ? reject(err) : resolve(value))));

/**
 * Todo login novo traz um aparelho (NewDeviceMetadata). Como a biblioteca oficial,
 * o painel sempre o registra (ConfirmDevice com o verificador SRP): com o rastreio
 * de aparelhos ligado, a renovação do acesso exige essa chave. Só fica lembrado
 * (pula o MFA por 24 h) se a pessoa marcou "confiar neste computador".
 * Devolve a chave do aparelho, para a sessão usar na renovação.
 */
export async function confirm(call, { accessToken, newDevice, usernames, trust }) {
  if (!newDevice?.DeviceKey) return null;
  const { DeviceKey, DeviceGroupKey } = newDevice;
  const helper = new AuthenticationHelper(DeviceGroupKey);
  await callbackToPromise((cb) => helper.generateHashDevice(DeviceGroupKey, DeviceKey, cb));
  await call("ConfirmDevice", {
    AccessToken: accessToken,
    DeviceKey,
    DeviceName: `Painel Sincofarma (${navigator.platform || "navegador"})`,
    DeviceSecretVerifierConfig: {
      Salt: Buffer.from(helper.getSaltDevices(), "hex").toString("base64"),
      PasswordVerifier: Buffer.from(helper.getVerifierDevices(), "hex").toString("base64"),
    },
  });
  if (trust) {
    await call("UpdateDeviceStatus", { AccessToken: accessToken, DeviceKey, DeviceRememberedStatus: "remembered" });
    save(usernames, { deviceKey: DeviceKey, groupKey: DeviceGroupKey, secret: helper.getRandomPassword(), until: Date.now() + TRUST_MS });
  }
  return DeviceKey;
}

async function hmacSha256(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/**
 * Responde DEVICE_SRP_AUTH e DEVICE_PASSWORD_VERIFIER (no lugar do código do MFA).
 * Devolve a resposta final do Cognito (tokens ou outro desafio).
 */
export async function authenticate(call, { clientId, session, username, device }) {
  const helper = new AuthenticationHelper(device.groupKey);
  const A = await callbackToPromise((cb) => helper.getLargeAValue(cb));
  const step = await call("RespondToAuthChallenge", {
    ClientId: clientId,
    ChallengeName: "DEVICE_SRP_AUTH",
    Session: session,
    ChallengeResponses: { USERNAME: username, DEVICE_KEY: device.deviceKey, SRP_A: A.toString(16) },
  });
  const p = step.ChallengeParameters;
  const hkdf = await callbackToPromise((cb) =>
    helper.getPasswordAuthenticationKey(device.deviceKey, device.secret, new BigInteger(p.SRP_B, 16), new BigInteger(p.SALT, 16), cb)
  );
  const timestamp = new DateHelper().getNowString();
  const message = Buffer.concat([
    Buffer.from(device.groupKey, "utf8"),
    Buffer.from(device.deviceKey, "utf8"),
    Buffer.from(p.SECRET_BLOCK, "base64"),
    Buffer.from(timestamp, "utf8"),
  ]);
  const signature = Buffer.from(await hmacSha256(new Uint8Array(hkdf), message)).toString("base64");
  return call("RespondToAuthChallenge", {
    ClientId: clientId,
    ChallengeName: "DEVICE_PASSWORD_VERIFIER",
    Session: step.Session,
    ChallengeResponses: {
      USERNAME: p.USERNAME || username,
      PASSWORD_CLAIM_SECRET_BLOCK: p.SECRET_BLOCK,
      TIMESTAMP: timestamp,
      PASSWORD_CLAIM_SIGNATURE: signature,
      DEVICE_KEY: device.deviceKey,
    },
  });
}
