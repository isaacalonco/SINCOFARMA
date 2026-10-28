const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const DEFAULT_TIMEOUT = 15000;

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.cause = cause;
  }
}

/** Avisa o AuthProvider que a sessão expirou (401). */
export const UNAUTHORIZED_EVENT = "sinco:unauthorized";

/**
 * Cliente HTTP mínimo: JSON, token, timeout e erros tipados.
 * - headers do chamador se somam aos padrão (não os apagam);
 * - 401 dispara evento global para encerrar a sessão;
 * - falha de rede e timeout viram ApiError com status 0.
 */
export async function api(path, { headers = {}, timeout = DEFAULT_TIMEOUT, ...options } = {}) {
  if (!API_URL) throw new ApiError("VITE_API_URL não configurada.", { status: 0 });

  const token = localStorage.getItem("token");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = err?.name === "AbortError";
    throw new ApiError(timedOut ? "Tempo de resposta esgotado." : "Sem conexão com o servidor.", { status: 0, cause: err });
  }
  clearTimeout(timer);

  const data = await response.json().catch(() => null);
  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError("Sessão expirada. Entre novamente.", { status: 401, data });
  }
  if (!response.ok) {
    throw new ApiError(data?.message || `Erro ${response.status} na requisição.`, { status: response.status, data });
  }
  return data;
}
