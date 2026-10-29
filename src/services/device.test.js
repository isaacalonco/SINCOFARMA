import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_COGNITO_REGION", "sa-east-1");
vi.stubEnv("VITE_COGNITO_CLIENT_ID", "cliente-teste");

// localStorage simples (o ambiente de teste é Node)
const store = new Map();
vi.stubGlobal("localStorage", {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
});

const cognito = await import("./cognito");
const device = await import("./device");

const CPF = "06590146101";
const TOKENS = { AccessToken: "a", IdToken: "i", RefreshToken: "r", ExpiresIn: 900 };
const DEVICE = { deviceKey: "sa-east-1_abc", groupKey: "grupo", secret: "segredo", until: Date.now() + 3_600_000 };

/** Cognito simulado: cada resposta na ordem; guarda o que foi pedido. */
function mockCognito(...responses) {
  const calls = [];
  globalThis.fetch = vi.fn(async (_url, init) => {
    calls.push({ target: init.headers["X-Amz-Target"].split(".").pop(), body: JSON.parse(init.body) });
    const { status = 200, body = {} } = responses.shift() ?? {};
    return { ok: status < 400, json: async () => body };
  });
  return calls;
}

describe("confiar neste computador", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => store.clear());
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("aparelho lembrado: senha + prova do aparelho, sem código do MFA", async () => {
    store.set(`sinco:device:${CPF}`, JSON.stringify(DEVICE));
    const calls = mockCognito(
      { body: { ChallengeName: "DEVICE_SRP_AUTH", Session: "s1", ChallengeParameters: { USERNAME: CPF } } },
      { body: { ChallengeName: "DEVICE_PASSWORD_VERIFIER", Session: "s2", ChallengeParameters: { USERNAME: CPF, SRP_B: "abcdef0123456789", SALT: "0f0f", SECRET_BLOCK: "AAAA" } } },
      { body: { AuthenticationResult: TOKENS } }
    );
    const tokens = await cognito.initiateAuth(CPF, "SenhaForte2026");
    expect(tokens).toMatchObject({ accessToken: "a", deviceKey: DEVICE.deviceKey });
    expect(calls[0].body.AuthParameters.DEVICE_KEY).toBe(DEVICE.deviceKey);
    expect(calls[1].body).toMatchObject({ ChallengeName: "DEVICE_SRP_AUTH", ChallengeResponses: { DEVICE_KEY: DEVICE.deviceKey } });
    expect(calls[1].body.ChallengeResponses.SRP_A).toMatch(/^[0-9a-f]+$/);
    const verifier = calls[2].body;
    expect(verifier).toMatchObject({ ChallengeName: "DEVICE_PASSWORD_VERIFIER", Session: "s2" });
    expect(verifier.ChallengeResponses.PASSWORD_CLAIM_SIGNATURE).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(verifier.ChallengeResponses.TIMESTAMP).toMatch(/UTC \d{4}$/);
  });

  it("se a prova do aparelho falhar, esquece o aparelho e pede o código normalmente", async () => {
    store.set(`sinco:device:${CPF}`, JSON.stringify(DEVICE));
    const calls = mockCognito(
      { body: { ChallengeName: "DEVICE_SRP_AUTH", Session: "s1", ChallengeParameters: {} } },
      { status: 400, body: { __type: "NotAuthorizedException" } },
      { body: { ChallengeName: "SOFTWARE_TOKEN_MFA", Session: "s3", ChallengeParameters: { USER_ID_FOR_SRP: CPF } } }
    );
    const err = await cognito.initiateAuth(CPF, "SenhaForte2026").catch((e) => e);
    expect(err.challenge).toBe("SOFTWARE_TOKEN_MFA");
    expect(calls[2].body.AuthParameters.DEVICE_KEY).toBeUndefined();
    expect(store.has(`sinco:device:${CPF}`)).toBe(false);
  });

  it("senha errada não apaga o aparelho confiável", async () => {
    store.set(`sinco:device:${CPF}`, JSON.stringify(DEVICE));
    mockCognito({ status: 400, body: { __type: "NotAuthorizedException" } }, { status: 400, body: { __type: "NotAuthorizedException" } });
    await expect(cognito.initiateAuth(CPF, "errada")).rejects.toThrow(/senha incorretos/);
    expect(store.has(`sinco:device:${CPF}`)).toBe(true);
  });

  it("depois de 24 h o aparelho não é mais usado", async () => {
    store.set(`sinco:device:${CPF}`, JSON.stringify({ ...DEVICE, until: Date.now() - 1 }));
    const calls = mockCognito({ body: { ChallengeName: "SOFTWARE_TOKEN_MFA", Session: "s1", ChallengeParameters: {} } });
    await cognito.initiateAuth(CPF, "SenhaForte2026").catch(() => {});
    expect(calls[0].body.AuthParameters.DEVICE_KEY).toBeUndefined();
    expect(store.has(`sinco:device:${CPF}`)).toBe(false);
  });

  it("com 'confiar': registra e lembra o aparelho por 24 h", async () => {
    const calls = mockCognito(
      { body: { AuthenticationResult: { ...TOKENS, NewDeviceMetadata: { DeviceKey: "sa-east-1_novo", DeviceGroupKey: "g1" } } } },
      { body: { UserConfirmationNecessary: true } },
      { body: {} }
    );
    const tokens = await cognito.answerTotp({ username: CPF, session: "s", loginName: CPF }, "123456", true);
    expect(tokens.deviceKey).toBe("sa-east-1_novo");
    expect(calls.map((c) => c.target)).toEqual(["RespondToAuthChallenge", "ConfirmDevice", "UpdateDeviceStatus"]);
    expect(calls[1].body.DeviceSecretVerifierConfig.PasswordVerifier).toBeTruthy();
    expect(calls[2].body.DeviceRememberedStatus).toBe("remembered");
    const saved = device.trusted(CPF);
    expect(saved.deviceKey).toBe("sa-east-1_novo");
    expect(saved.until - Date.now()).toBeGreaterThan(23 * 3_600_000);
  });

  it("sem 'confiar': registra o aparelho (para renovar a sessão), mas não lembra", async () => {
    const calls = mockCognito(
      { body: { AuthenticationResult: { ...TOKENS, NewDeviceMetadata: { DeviceKey: "sa-east-1_novo", DeviceGroupKey: "g1" } } } },
      { body: { UserConfirmationNecessary: true } }
    );
    const tokens = await cognito.answerTotp({ username: CPF, session: "s" }, "123456", false);
    expect(tokens.deviceKey).toBe("sa-east-1_novo");
    expect(calls.map((c) => c.target)).toEqual(["RespondToAuthChallenge", "ConfirmDevice"]);
    expect(device.trusted(CPF)).toBeNull();
  });

  it("falha ao registrar o aparelho não derruba o login", async () => {
    mockCognito(
      { body: { AuthenticationResult: { ...TOKENS, NewDeviceMetadata: { DeviceKey: "k", DeviceGroupKey: "g" } } } },
      { status: 400, body: { __type: "InternalErrorException" } }
    );
    const tokens = await cognito.answerTotp({ username: CPF, session: "s" }, "123456", true);
    expect(tokens.accessToken).toBe("a");
    expect(tokens.deviceKey).toBeUndefined();
  });

  it("renovação do acesso leva a chave do aparelho", async () => {
    const calls = mockCognito({ body: { AuthenticationResult: TOKENS } });
    await cognito.refresh("r", "sa-east-1_abc");
    expect(calls[0].body.AuthParameters).toEqual({ REFRESH_TOKEN: "r", DEVICE_KEY: "sa-east-1_abc" });
  });
});
