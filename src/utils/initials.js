/** Iniciais do nome: primeira letra do primeiro e do último nome. */
export function initials(name = "") {
  const parts = name.replace(/^(dra?\.?\s+)/i, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
