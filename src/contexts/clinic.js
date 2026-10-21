import { createContext, useContext } from "react";

export const ClinicContext = createContext(null);

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic precisa estar dentro de <ClinicProvider>");
  return ctx;
}

/** Normaliza texto para busca (sem acento, minúsculo). */
export function normalize(text = "") {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matchesQuery(visit, query) {
  const q = normalize(query.trim());
  if (!q) return true;
  return [visit.name, visit.cpf, visit.complaint, visit.signs, visit.rt, visit.time]
    .some((field) => normalize(field).includes(q));
}
