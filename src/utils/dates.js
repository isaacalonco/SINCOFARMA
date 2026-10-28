/** Utilitários de data centralizados (pt-BR). */

export function isSameDay(iso, ref = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function timeLabel(date = new Date()) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "Novembro 2025" */
export function monthLabel(date = new Date()) {
  const s = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.replace(/^(\w)/, (c) => c.toUpperCase()).replace(" de ", " ");
}

/** "dd/mm/aaaa" -> Date (ou null se inválida ou inexistente no calendário) */
export function parseBrDate(masked) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(masked)) return null;
  const [dd, mm, yyyy] = masked.split("/").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  const valid = d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
  return valid ? d : null;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
