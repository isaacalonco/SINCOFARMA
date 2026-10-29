// Repositório simulado: mesma interface do apiRepository, dados no localStorage.
// Usado quando VITE_API_URL não está definida.
import { seedVisits, rndsQueue, baseline, weekBase, historicAverage, unit } from "./mockData";
import { isVisit } from "./stats";
import { timeLabel } from "../utils/dates";

const KEY = "sinco:clinic";
const SCHEMA = 2;
const LATENCY = 350;

// encaminhamentos de demonstração: mesma forma que a API devolve
const DEMO_DOCTORS = [
  { id: "demo-medico-1", name: "Dr. Paulo Lima" },
  { id: "demo-medico-2", name: "Dra. Carla Nunes" },
];
let referrals = [];
let demoUsers = [
  { id: "demo-1", name: "Dra. Ana Souza", email: "ana@exemplo.com.br", cpf: "***.982.247-**", crf: "4192", roles: ["farmaceutico"], unit: "demo", enabled: true, pending: false },
  { id: "demo-2", name: "Dr. Paulo Lima", email: "paulo@exemplo.com.br", cpf: "***.533.447-**", crf: null, roles: ["medico"], unit: null, enabled: true, pending: true },
  { id: "demo-3", name: "Gestor Sincofarma", email: "gestor@exemplo.com.br", cpf: "***.444.777-**", crf: null, roles: ["admin"], unit: null, enabled: true, pending: false },
];
const referralSummary = (r) => ({
  id: r.id,
  createdAt: r.createdAt,
  status: r.status,
  statusAt: r.statusAt,
  priority: r.priority,
  urgent: r.urgent,
  risk: r.clinical.risk,
  patientName: r.patient.name,
  complaint: r.clinical.complaint.text,
  protocol: r.protocol,
  unit: r.unit,
  unitName: r.unitName,
  fromName: r.from.name,
  doctorName: r.doctor.name,
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function seedsForToday() {
  const today = new Date();
  return seedVisits.map((v) => {
    const [h, m] = v.time.split(":").map(Number);
    const at = new Date(today);
    at.setHours(h, m, 0, 0);
    return { ...v, at: at.toISOString() };
  });
}

function fresh() {
  return { schema: SCHEMA, visits: seedsForToday(), rndsIndex: 0, lastSync: null };
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || saved.schema !== SCHEMA || !Array.isArray(saved.visits)) return fresh();
    return {
      schema: SCHEMA,
      visits: saved.visits.filter(isVisit).map((v) => ({
        ...v,
        at: typeof v.at === "string" && !Number.isNaN(Date.parse(v.at)) ? v.at : new Date().toISOString(),
      })),
      rndsIndex: Number.isInteger(saved.rndsIndex) ? Math.min(saved.rndsIndex, rndsQueue.length) : 0,
      lastSync: typeof saved.lastSync === "string" ? saved.lastSync : null,
    };
  } catch {
    return fresh();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem espaço / modo privado: fica só em memória nesta sessão */
  }
}

// carregado sob demanda: importar este módulo não grava nada no navegador
// (com a API ligada ele nem chega a ser usado)
let loaded = null;
function current() {
  if (!loaded) {
    loaded = read();
    write(loaded); // normaliza o formato salvo (migração de schema)
  }
  return loaded;
}

export const mockRepository = {
  name: "mock",

  // a demonstração tem uma farmácia só; `unit` é ignorado
  async listUnits() {
    await wait(LATENCY);
    return [{ id: "demo", name: unit }];
  },

  async loadDashboard() {
    await wait(LATENCY);
    return {
      visits: current().visits,
      lastSync: current().lastSync,
      rndsPending: rndsQueue.length - current().rndsIndex,
      baseline,
      week: weekBase,
      historicAverage,
      unit,
    };
  },

  // `clinical` (dados pessoais e clínicos completos) é descartado de propósito:
  // em modo demonstração nada além do resumo fica no navegador.
  // eslint-disable-next-line no-unused-vars
  async createVisit(data, clinical) {
    await wait(LATENCY);
    const now = new Date();
    const visit = { ...data, id: `v${now.getTime()}`, at: now.toISOString(), time: timeLabel(now), isNew: true };
    loaded = { ...current(), visits: [visit, ...current().visits] };
    write(loaded);
    return visit;
  },

  async updateVisit(id, patch) {
    await wait(LATENCY / 2);
    const found = current().visits.find((v) => v.id === id);
    if (!found) throw new Error("Atendimento não encontrado.");
    const updated = { ...found, ...patch };
    loaded = { ...current(), visits: current().visits.map((v) => (v.id === id ? updated : v)) };
    write(loaded);
    return updated;
  },

  async syncRnds() {
    await wait(1400);
    const st = current();
    const next = rndsQueue[st.rndsIndex];
    const now = new Date();
    const lastSync = now.toISOString();
    let imported = null;
    if (next) {
      imported = { ...next, id: `r${now.getTime()}`, at: lastSync, time: timeLabel(now), isNew: true, source: "RNDS" };
      loaded = { ...st, visits: [imported, ...st.visits], rndsIndex: st.rndsIndex + 1, lastSync };
    } else {
      loaded = { ...st, lastSync };
    }
    write(loaded);
    return { imported, lastSync, rndsPending: rndsQueue.length - loaded.rndsIndex };
  },

  /* ---------- encaminhamentos (em memória; some ao recarregar) ---------- */
  async listDoctors() {
    await wait(LATENCY / 2);
    return DEMO_DOCTORS;
  },

  async listReferrals(status) {
    await wait(LATENCY / 2);
    return referrals.filter((r) => !status || r.status === status).map(referralSummary);
  },

  async getReferral(id) {
    await wait(LATENCY / 2);
    const found = referrals.find((r) => r.id === id);
    if (!found) throw new Error("Encaminhamento não encontrado.");
    return found;
  },

  async createReferral({ visitId, doctorId, reason, priority = "rotina" }) {
    await wait(LATENCY);
    const visit = current().visits.find((v) => v.id === visitId);
    const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId);
    if (!visit || !doctor) throw new Error("Atendimento ou médico não encontrado.");
    const now = new Date().toISOString();
    const ref = {
      id: `ref${Date.now()}`,
      visitId,
      protocol: visit.protocol,
      unit: "demo",
      unitName: unit,
      createdAt: now,
      status: "sent",
      statusAt: now,
      priority,
      urgent: priority === "urgente" || !!visit.urgent,
      reason,
      from: { name: "Dra. Ana Souza", crf: "4192" },
      doctor,
      // a demonstração não guarda a ficha completa: só o resumo do atendimento
      patient: { name: visit.name, cpf: visit.cpf },
      clinical: { complaint: { text: visit.complaint }, risk: visit.risk, redFlags: visit.redFlags ?? [], notes: visit.signs },
      response: null,
      answeredAt: null,
      mine: true,
    };
    referrals = [ref, ...referrals];
    return ref;
  },

  async updateReferral(id, { status, response = null }) {
    await wait(LATENCY / 2);
    const found = referrals.find((r) => r.id === id);
    if (!found) throw new Error("Encaminhamento não encontrado.");
    if (!["sent", "read"].includes(found.status)) throw new Error("Este encaminhamento já foi encerrado.");
    const now = new Date().toISOString();
    const updated = { ...found, status, statusAt: now, ...(response ? { response, answeredAt: now } : {}) };
    referrals = referrals.map((r) => (r.id === id ? updated : r));
    return updated;
  },

  /** Ficha do atendimento: a demonstração só guarda o resumo, então a ficha sai parcial. */
  async getVisitRecord(id) {
    await wait(LATENCY);
    const visit = current().visits.find((v) => v.id === id);
    if (!visit) throw new Error("Atendimento não encontrado.");
    return {
      visit,
      record: {
        protocol: visit.protocol,
        at: visit.at,
        patient: { name: visit.name, cpf: visit.cpf },
        complaint: { text: visit.complaint },
        history: { allergies: [], comorbidities: [], medications: [] },
        vitals: {},
        risk: visit.risk ?? null,
        redFlags: visit.redFlags ?? [],
        notes: visit.signs || null,
      },
      history: [{ at: visit.at, action: "create", label: "Atendimento registrado", actor: visit.rt || "Dra. Ana Souza", changes: {} }],
    };
  },

  async listAudit(month) {
    await wait(LATENCY);
    return { month, events: [], next: null, units: [{ id: "demo", name: unit }] };
  },

  /* ---------- usuários (administração; em memória) ---------- */
  async listUsers() {
    await wait(LATENCY);
    return { users: demoUsers, units: [{ id: "demo", name: unit }] };
  },

  async createUser({ cpf, name, email, roles, unit: unitId = null, crf = null }) {
    await wait(LATENCY);
    const masked = `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
    const user = { id: `demo-${Date.now()}`, name, email, cpf: masked, crf, roles, unit: unitId, enabled: true, pending: true };
    demoUsers = [...demoUsers, user].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return user;
  },

  async updateUser(id, change) {
    await wait(LATENCY / 2);
    // reset do MFA e reenvio do convite não têm efeito na demonstração
    const patch = Object.fromEntries(Object.entries(change).filter(([k]) => ["roles", "unit", "enabled"].includes(k)));
    const found = demoUsers.find((u) => u.id === id);
    if (!found) throw new Error("Usuário não encontrado.");
    const updated = { ...found, ...patch };
    demoUsers = demoUsers.map((u) => (u.id === id ? updated : u));
    return updated;
  },

  async reset() {
    loaded = fresh();
    write(loaded);
    return this.loadDashboard();
  },

  /** Apaga o cache local (chamado no logout). */
  clear() {
    loaded = null;
    referrals = [];
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignora */
    }
  },
};
