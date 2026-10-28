// Repositório real: fala com a API via src/services/api.js.
// Contrato esperado do backend (ajustar quando ele existir):
//   GET   /dashboard            -> { visits, lastSync, rndsPending, baseline, week, historicAverage, unit }
//   POST  /visits               -> visit criado
//   PATCH /visits/:id           -> visit atualizado
//   POST  /rnds/sync            -> { imported, lastSync, rndsPending }
import { api } from "../services/api";

export const apiRepository = {
  name: "api",
  loadDashboard: () => api("/dashboard"),
  createVisit: (data) => api("/visits", { method: "POST", body: JSON.stringify(data) }),
  updateVisit: (id, patch) => api(`/visits/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  syncRnds: () => api("/rnds/sync", { method: "POST" }),
  reset: () => Promise.reject(new Error("Indisponível com backend real.")),
  clear: () => {},
};
