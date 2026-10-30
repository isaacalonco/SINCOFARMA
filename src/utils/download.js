/**
 * Baixa `data` como arquivo JSON legível (portabilidade, LGPD art. 18, V).
 * Gera o arquivo no próprio navegador: nada passa por outro servidor.
 */
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // dá tempo de o navegador começar o download antes de soltar o arquivo
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "sincofarma-meus-dados-2026-10-29.json" */
export const datedName = (base) => `${base}-${new Date().toISOString().slice(0, 10)}.json`;
