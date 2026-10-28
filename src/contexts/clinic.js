import { createContext, useContext } from "react";

export const ClinicContext = createContext(null);
// Busca e avisos mudam com frequência (cada tecla / cada aviso). Ficam em
// contextos próprios para não re-renderizar quem só lê os dados clínicos.
export const SearchContext = createContext(null);
export const ToastContext = createContext(null);

function required(ctx, name) {
  if (!ctx) throw new Error(`${name} precisa estar dentro de <ClinicProvider>`);
  return ctx;
}

export const useClinic = () => required(useContext(ClinicContext), "useClinic");
export const useSearch = () => required(useContext(SearchContext), "useSearch");
export const useToasts = () => required(useContext(ToastContext), "useToasts");

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
