/** Utilitários de CPF e máscaras numéricas. */

export const digits = (v = "") => String(v).replace(/\D/g, "");

/** Aplica um padrão com `#` para dígitos, ex.: "###.###.###-##". */
export function applyMask(value, pattern) {
  const d = digits(value);
  let out = "";
  let i = 0;
  for (const ch of pattern) {
    if (i >= d.length) break;
    out += ch === "#" ? d[i++] : ch;
  }
  return out;
}

export const maskCpf = (value) => applyMask(value, "###.###.###-##");

/** Validação pelos dígitos verificadores (rejeita sequências repetidas). */
export function isValidCpf(value) {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const check = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/**
 * Forma exibível sem identificar a pessoa: mantém só os 2 dígitos
 * verificadores ("***.***.***-25"). Útil para listagens; o CPF completo
 * nunca deve ficar em cache do navegador.
 */
export function anonymizeCpf(value) {
  const d = digits(value);
  if (d.length !== 11) return "***.***.***-**";
  return `***.***.***-${d.slice(9)}`;
}
