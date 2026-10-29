// Repositório real: fala com a API via src/services/api.js.
// Contrato esperado do backend (ajustar quando ele existir):
//   GET   /dashboard[?unidade=] -> { visits, todaySummary, lastSync, rndsPending, baseline, week, historicAverage, unit }
//                                  (administração: `?unidade=` e `visits` vazio, só números)
//   GET   /unidades             -> { units: [{ id, name }] } (só administração)
//   POST  /visits               { ...summary, clinical } -> visit (resumo) criado
//   PATCH /visits/:id           -> visit atualizado
//   POST  /rnds/sync            -> { imported, lastSync, rndsPending }
// Encaminhamentos (detalhes e permissões em backend/README.md):
//   GET   /medicos                     -> { doctors: [{ id, name }] }           (farmacêutico)
//   POST  /encaminhamentos             { visitId, doctorId, reason, priority } -> encaminhamento
//   GET   /encaminhamentos[?status=]   -> { referrals: [resumo] }               (farmácia ou caixa do médico)
//   GET   /encaminhamentos/:id         -> encaminhamento com a ficha (médico abrindo: vira "read")
//   PATCH /encaminhamentos/:id         { status: answered|declined|cancelled, response? } -> encaminhamento
import { api } from "../services/api";

export const apiRepository = {
  name: "api",
  loadDashboard: (unit) => api(unit ? `/dashboard?unidade=${encodeURIComponent(unit)}` : "/dashboard"),
  listUnits: () => api("/unidades").then((r) => r.units),
  createVisit: (summary, clinical) => api("/visits", { method: "POST", body: JSON.stringify({ ...summary, clinical }) }),
  updateVisit: (id, patch) => api(`/visits/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  syncRnds: () => api("/rnds/sync", { method: "POST" }),
  listDoctors: () => api("/medicos").then((r) => r.doctors),
  listReferrals: (status) => api(status ? `/encaminhamentos?status=${encodeURIComponent(status)}` : "/encaminhamentos").then((r) => r.referrals),
  getReferral: (id) => api(`/encaminhamentos/${encodeURIComponent(id)}`),
  createReferral: (data) => api("/encaminhamentos", { method: "POST", body: JSON.stringify(data) }),
  updateReferral: (id, change) => api(`/encaminhamentos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change) }),
  reset: () => Promise.reject(new Error("Indisponível com backend real.")),
  clear: () => {},
};
