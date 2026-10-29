// Repositório real: fala com a API via src/services/api.js.
// Contrato esperado do backend (ajustar quando ele existir):
//   GET   /dashboard[?unidade=] -> { visits, todaySummary, lastSync, rndsPending, baseline, week, historicAverage, unit }
//                                  (administração: `?unidade=` e `visits` vazio, só números)
//   GET   /unidades             -> { units: [{ id, name }] } (só administração)
//   POST  /visits               { ...summary, clinical } -> visit (resumo) criado
//   PATCH /visits/:id           -> visit atualizado
//   POST  /rnds/sync            -> { imported, lastSync, rndsPending }
import { api } from "../services/api";

export const apiRepository = {
  name: "api",
  loadDashboard: (unit) => api(unit ? `/dashboard?unidade=${encodeURIComponent(unit)}` : "/dashboard"),
  listUnits: () => api("/unidades").then((r) => r.units),
  createVisit: (summary, clinical) => api("/visits", { method: "POST", body: JSON.stringify({ ...summary, clinical }) }),
  updateVisit: (id, patch) => api(`/visits/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  syncRnds: () => api("/rnds/sync", { method: "POST" }),
  reset: () => Promise.reject(new Error("Indisponível com backend real.")),
  clear: () => {},
};
