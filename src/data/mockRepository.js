// Repositório simulado: mesma interface do apiRepository, dados no localStorage.
// Usado quando VITE_API_URL não está definida.
import { seedVisits, rndsQueue, baseline, weekBase, historicAverage, unit } from "./mockData";
import { isVisit } from "./stats";
import { timeLabel } from "../utils/dates";

const KEY = "sinco:clinic";
const SCHEMA = 2;
const LATENCY = 350;

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

let state = read();
// garante que o armazenamento reflita o formato atual (útil após migração de schema)
write(state);

export const mockRepository = {
  name: "mock",

  async loadDashboard() {
    await wait(LATENCY);
    return {
      visits: state.visits,
      lastSync: state.lastSync,
      rndsPending: rndsQueue.length - state.rndsIndex,
      baseline,
      week: weekBase,
      historicAverage,
      unit,
    };
  },

  async createVisit(data) {
    await wait(LATENCY);
    const now = new Date();
    const visit = { ...data, id: `v${now.getTime()}`, at: now.toISOString(), time: timeLabel(now), isNew: true };
    state = { ...state, visits: [visit, ...state.visits] };
    write(state);
    return visit;
  },

  async updateVisit(id, patch) {
    await wait(LATENCY / 2);
    const current = state.visits.find((v) => v.id === id);
    if (!current) throw new Error("Atendimento não encontrado.");
    const updated = { ...current, ...patch };
    state = { ...state, visits: state.visits.map((v) => (v.id === id ? updated : v)) };
    write(state);
    return updated;
  },

  async syncRnds() {
    await wait(1400);
    const next = rndsQueue[state.rndsIndex];
    const now = new Date();
    const lastSync = now.toISOString();
    let imported = null;
    if (next) {
      imported = { ...next, id: `r${now.getTime()}`, at: lastSync, time: timeLabel(now), isNew: true, source: "RNDS" };
      state = { ...state, visits: [imported, ...state.visits], rndsIndex: state.rndsIndex + 1, lastSync };
    } else {
      state = { ...state, lastSync };
    }
    write(state);
    return { imported, lastSync, rndsPending: rndsQueue.length - state.rndsIndex };
  },

  async reset() {
    state = fresh();
    write(state);
    return this.loadDashboard();
  },

  /** Apaga o cache local (chamado no logout). */
  clear() {
    state = fresh();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignora */
    }
  },
};
