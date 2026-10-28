import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// o módulo lê a configuração na importação
vi.stubEnv("VITE_COGNITO_REGION", "sa-east-1");
vi.stubEnv("VITE_COGNITO_CLIENT_ID", "cliente-teste");
const cognito = await import("./cognito");

const TOKENS = { AccessToken: "a", IdToken: "i", RefreshToken: "r", ExpiresIn: 900 };

/** Responde cada chamada ao Cognito na ordem dada e guarda o que foi enviado. */
function mockCognito(...responses) {
  const calls = [];
  globalThis.fetch = vi.fn(async (_url, init) => {
    calls.push({ target: init.headers["X-Amz-Target"].split(".").pop(), body: JSON.parse(init.body) });
    const { status = 200, body } = responses.shift();
    return { ok: status < 400, json: async () => body };
  });
  return calls;
}

async function challengeOf(promise) {
  const err = await promise.catch((e) => e);
  expect(err.code).toBe("Challenge");
  return err;
}

describe("login com MFA por app autenticador", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("primeiro login: senha leva ao cadastro do app, que conclui com tokens", async () => {
    const calls = mockCognito(
      { body: { ChallengeName: "MFA_SETUP", Session: "s1", ChallengeParameters: { USER_ID_FOR_SRP: "06590146101" } } },
      { body: { SecretCode: "ABCDEFGH", Session: "s2" } },
      { body: { Status: "SUCCESS", Session: "s3" } },
      { body: { AuthenticationResult: TOKENS } }
    );

    const err = await challengeOf(cognito.initiateAuth("065.901.461-01", "SenhaForte2026"));
    expect(err.challenge).toBe("MFA_SETUP");
    expect(err.username).toBe("06590146101");

    const setup = await cognito.startTotpSetup(err);
    expect(setup).toEqual({ username: "06590146101", session: "s2", secret: "ABCDEFGH" });

    const tokens = await cognito.finishTotpSetup(setup, "123456");
    expect(tokens.accessToken).toBe("a");

    expect(calls.map((c) => c.target)).toEqual([
      "InitiateAuth",
      "AssociateSoftwareToken",
      "VerifySoftwareToken",
      "RespondToAuthChallenge",
    ]);
    expect(calls[2].body).toMatchObject({ Session: "s2", UserCode: "123456" });
    expect(calls[3].body).toMatchObject({ ChallengeName: "MFA_SETUP", Session: "s3", ChallengeResponses: { USERNAME: "06590146101" } });
  });

  it("senha temporária encadeia a troca de senha e depois o cadastro do app", async () => {
    mockCognito(
      { body: { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "s1", ChallengeParameters: { USER_ID_FOR_SRP: "06590146101" } } },
      { body: { ChallengeName: "MFA_SETUP", Session: "s2" } }
    );
    const first = await challengeOf(cognito.initiateAuth("06590146101", "Temporaria#2026"));
    expect(first.challenge).toBe("NEW_PASSWORD_REQUIRED");

    const second = await challengeOf(cognito.completeNewPassword(first, "SenhaForte2026"));
    expect(second).toMatchObject({ challenge: "MFA_SETUP", session: "s2", username: "06590146101" });
  });

  it("logins seguintes: responde o código de 6 dígitos", async () => {
    const calls = mockCognito(
      { body: { ChallengeName: "SOFTWARE_TOKEN_MFA", Session: "s1", ChallengeParameters: { USER_ID_FOR_SRP: "06590146101" } } },
      { body: { AuthenticationResult: TOKENS } }
    );
    const err = await challengeOf(cognito.initiateAuth("06590146101", "SenhaForte2026"));
    const tokens = await cognito.answerTotp(err, "654321");
    expect(tokens.idToken).toBe("i");
    expect(calls[1].body).toMatchObject({
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: "s1",
      ChallengeResponses: { USERNAME: "06590146101", SOFTWARE_TOKEN_MFA_CODE: "654321" },
    });
  });

  it("código errado e sessão vencida têm mensagens próprias", async () => {
    mockCognito(
      { status: 400, body: { __type: "CodeMismatchException" } },
      { status: 400, body: { __type: "NotAuthorizedException" } },
      { status: 400, body: { __type: "EnableSoftwareTokenMFAException" } }
    );
    const challenge = { username: "06590146101", session: "s1" };
    await expect(cognito.answerTotp(challenge, "000000")).rejects.toThrow(/Código incorreto/);
    await expect(cognito.answerTotp(challenge, "000000")).rejects.toThrow(/esgotado/);
    await expect(cognito.finishTotpSetup(challenge, "000000")).rejects.toThrow(/Código incorreto/);
  });

  it("etapa desconhecida vira erro em vez de travar a tela", async () => {
    mockCognito({ body: { ChallengeName: "SMS_MFA", Session: "s1" } });
    const err = await cognito.initiateAuth("06590146101", "x").catch((e) => e);
    expect(err.code).toBe("SMS_MFA");
  });

  it("monta o otpauth:// sem o CPF inteiro no rótulo", () => {
    expect(cognito.totpUri("ABCDEFGH", "***6101")).toBe(
      "otpauth://totp/Sincofarma%20DF%3A***6101?secret=ABCDEFGH&issuer=Sincofarma%20DF"
    );
  });
});
