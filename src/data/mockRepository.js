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

  async reset() {
    loaded = fresh();
    write(loaded);
    return this.loadDashboard();
  },

  /** Apaga o cache local (chamado no logout). */
  clear() {
    loaded = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignora */
    }
  },
};
