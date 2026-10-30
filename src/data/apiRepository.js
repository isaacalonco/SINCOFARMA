// Repositório real: fala com a API via src/services/api.js.
// Contrato esperado do backend (ajustar quando ele existir):
//   GET   /dashboard[?unidade=] -> { visits, todaySummary, lastSync, rndsPending, baseline, week, historicAverage, unit }
//                                  (administração: `?unidade=` e `visits` vazio, só números)
//   GET   /unidades             -> { units: [{ id, name }] } (só administração)
//   POST  /visits               { ...summary, clinical } -> visit (resumo) criado
//   PATCH /visits/:id           -> visit atualizado
//   GET   /visits/:id           -> { visit, record (ficha clínica), history } (farmácia do atendimento)
//   POST  /rnds/sync            -> { imported, lastSync, rndsPending }
// Encaminhamentos (detalhes e permissões em backend/README.md):
//   GET   /medicos                     -> { doctors: [{ id, name }] }           (farmacêutico)
//   POST  /encaminhamentos             { visitId, doctorId, reason, priority } -> encaminhamento
//   GET   /encaminhamentos[?status=]   -> { referrals: [resumo] }               (farmácia ou caixa do médico)
//   GET   /encaminhamentos/:id         -> encaminhamento com a ficha (médico abrindo: vira "read")
//   PATCH /encaminhamentos/:id         { status: answered|declined|cancelled, response? } -> encaminhamento
// Usuários (administração):
//   GET   /usuarios       -> { users: [{ id, name, email, cpf (mascarado), crf, roles, unit, enabled, pending }], units }
//   POST  /usuarios       { cpf, name, email, roles, unit?, crf? } -> usuário (convite por e-mail)
//   PATCH /usuarios/:id   { roles?, unit?, enabled?, resetMfa?, resendInvite? } -> usuário
//   GET   /auditoria[?mes=aaaa-mm&inicio=] -> { month, events, next, units } (administração; sem dados de paciente)
// LGPD (direitos do titular):
//   GET   /me/dados                -> tudo o que o painel guarda sobre quem pede (JSON para baixar)
//   GET   /me/pedidos              -> { requests }            (os próprios pedidos)
//   POST  /me/pedidos              { type: correcao|exclusao, details } -> pedido
//   GET   /lgpd/pedidos[?status=]  -> { requests }            (administração)
//   PATCH /lgpd/pedidos/:id        { status: concluido|recusado, response } -> pedido (concluir exclusão anonimiza a conta)
//   POST  /lgpd/pacientes          { cpf } -> dados do paciente (administração; CPF no corpo, nunca na URL)
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
  getVisitRecord: (id) => api(`/visits/${encodeURIComponent(id)}`),
  listAudit: (month, start) =>
    api(`/auditoria?${new URLSearchParams({ mes: month, ...(start ? { inicio: start } : {}) })}`),
  listUsers: () => api("/usuarios"),
  createUser: (data) => api("/usuarios", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id, change) => api(`/usuarios/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change) }),
  getMyData: () => api("/me/dados", { timeout: 30000 }),
  listMyRequests: () => api("/me/pedidos").then((r) => r.requests),
  createMyRequest: (data) => api("/me/pedidos", { method: "POST", body: JSON.stringify(data) }),
  listPrivacyRequests: (status) => api(status ? `/lgpd/pedidos?status=${encodeURIComponent(status)}` : "/lgpd/pedidos").then((r) => r.requests),
  answerPrivacyRequest: (id, change) =>
    api(`/lgpd/pedidos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change), timeout: 60000 }),
  exportPatient: (cpf) => api("/lgpd/pacientes", { method: "POST", body: JSON.stringify({ cpf }), timeout: 30000 }),
  reset: () => Promise.reject(new Error("Indisponível com backend real.")),
  clear: () => {},
};
