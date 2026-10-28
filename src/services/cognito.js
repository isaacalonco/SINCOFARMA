// Cliente mínimo do Amazon Cognito (user pool) via HTTPS, sem SDK.
// Só as chamadas que o painel usa: login, troca de senha inicial, MFA por
// app autenticador (cadastro e código), renovação do token e revogação no logout.

const REGION = import.meta.env.VITE_COGNITO_REGION;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
// só para testes locais (servidor que simula o Cognito); em produção fica vazio
const ENDPOINT = import.meta.env.VITE_COGNITO_ENDPOINT || `https://cognito-idp.${REGION}.amazonaws.com/`;

export const COGNITO_ENABLED = Boolean(REGION && CLIENT_ID);

export class AuthError extends Error {
  constructor(message, { code, challenge, session, username } = {}) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.challenge = challenge;
    this.session = session;
    this.username = username;
  }
}

// mensagens em português para os erros que o usuário pode encontrar
const MESSAGES = {
  NotAuthorizedException: "CPF/CRF ou senha incorretos.",
  UserNotFoundException: "CPF/CRF ou senha incorretos.",
  PasswordResetRequiredException: "Sua senha precisa ser redefinida. Procure o gestor da unidade.",
  UserNotConfirmedException: "Cadastro ainda não confirmado. Procure o gestor da unidade.",
  TooManyRequestsException: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  LimitExceededException: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  InvalidPasswordException: "A nova senha não atende à política: mínimo de 12 caracteres, com maiúscula, minúscula e número.",
  CodeMismatchException: "Sessão de troca de senha expirada. Entre de novo.",
  ExpiredCodeException: "Sessão de troca de senha expirada. Entre de novo.",
};

// nas etapas de MFA os mesmos erros querem dizer outra coisa
const MFA_MESSAGES = {
  CodeMismatchException: "Código incorreto. Confira o app autenticador e tente de novo.",
  EnableSoftwareTokenMFAException: "Código incorreto. Confira o app autenticador e tente de novo.",
  ExpiredCodeException: "Código já usado. Aguarde o próximo código do app.",
  NotAuthorizedException: "Tempo para concluir o login esgotado. Entre de novo.",
  ResourceNotFoundException: "Tempo para concluir o login esgotado. Entre de novo.",
};

async function call(target, body, messages = MESSAGES) {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AuthError("Sem conexão com o serviço de login.", { code: "Network", cause: err });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(data.__type || "").split("#").pop();
    throw new AuthError(messages[code] || MESSAGES[code] || "Não foi possível entrar. Tente novamente.", { code });
  }
  return data;
}

/** CPF (11 dígitos) é o username; o CRF entra pelo alias `crf<número>`. */
export function toUsername(identifier) {
  const digits = String(identifier || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 11 ? digits : `crf${digits}`;
}

function tokensFrom(result) {
  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: result.RefreshToken,
    expiresIn: result.ExpiresIn,
  };
}

// etapas que o painel sabe conduzir; qualquer outra vira erro
const CHALLENGES = {
  NEW_PASSWORD_REQUIRED: "Defina uma nova senha para continuar.", // primeiro acesso
  MFA_SETUP: "Configure o app autenticador para continuar.", // primeiro login com MFA
  SOFTWARE_TOKEN_MFA: "Digite o código do app autenticador.",
};

/** Tokens, ou um AuthError "Challenge" com a próxima etapa (o Cognito pode encadear várias). */
function resultOrChallenge(data, username) {
  if (!data.ChallengeName) return tokensFrom(data.AuthenticationResult);
  if (!CHALLENGES[data.ChallengeName]) {
    throw new AuthError("Etapa adicional de login não suportada. Procure o gestor da unidade.", { code: data.ChallengeName });
  }
  throw new AuthError(CHALLENGES[data.ChallengeName], {
    code: "Challenge",
    challenge: data.ChallengeName,
    session: data.Session,
    username: data.ChallengeParameters?.USER_ID_FOR_SRP || username,
  });
}

export async function initiateAuth(identifier, password) {
  const username = toUsername(identifier);
  const data = await call("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  });
  return resultOrChallenge(data, username);
}

export async function completeNewPassword({ username, session }, newPassword) {
  const data = await call("RespondToAuthChallenge", {
    ClientId: CLIENT_ID,
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    Session: session,
    ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
  });
  return resultOrChallenge(data, username);
}

/** MFA_SETUP, passo 1: gera o segredo que o app autenticador vai guardar. */
export async function startTotpSetup({ username, session }) {
  const data = await call("AssociateSoftwareToken", { Session: session }, MFA_MESSAGES);
  return { username, session: data.Session, secret: data.SecretCode };
}

/** MFA_SETUP, passo 2: confere o primeiro código do app e conclui o login. */
export async function finishTotpSetup({ username, session }, code) {
  const verified = await call(
    "VerifySoftwareToken",
    { Session: session, UserCode: code, FriendlyDeviceName: "Painel Sincofarma" },
    MFA_MESSAGES
  );
  const data = await call(
    "RespondToAuthChallenge",
    {
      ClientId: CLIENT_ID,
      ChallengeName: "MFA_SETUP",
      Session: verified.Session,
      ChallengeResponses: { USERNAME: username },
    },
    MFA_MESSAGES
  );
  return resultOrChallenge(data, username);
}

/** Login com MFA já configurado: responde o código de 6 dígitos. */
export async function answerTotp({ username, session }, code) {
  const data = await call(
    "RespondToAuthChallenge",
    {
      ClientId: CLIENT_ID,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: session,
      ChallengeResponses: { USERNAME: username, SOFTWARE_TOKEN_MFA_CODE: code },
    },
    MFA_MESSAGES
  );
  return resultOrChallenge(data, username);
}

/** Endereço otpauth:// que vira o QR code lido pelo app autenticador. */
export function totpUri(secret, account) {
  const label = encodeURIComponent(`Sincofarma DF:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Sincofarma DF")}`;
}

export async function refresh(refreshToken) {
  const data = await call("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  // sem rotação: o refresh token continua o mesmo
  return { ...tokensFrom(data.AuthenticationResult), refreshToken };
}

export async function revoke(refreshToken) {
  await call("RevokeToken", { ClientId: CLIENT_ID, Token: refreshToken });
}
