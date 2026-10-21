import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicContext } from "./clinic";
import { base, seedVisits, weekBase, rndsQueue } from "../pages/Dashboard/data";

const STORAGE_KEY = "sinco:clinic";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.visits)) return saved;
  } catch {
    /* ignora dados corrompidos */
  }
  return { visits: seedVisits, rndsIndex: 0, lastSync: null };
}

function countBy(list) {
  const out = { done: 0, referred: 0, progress: 0 };
  list.forEach((v) => {
    out[v.status] += 1;
  });
  return out;
}

const SEED_COUNTS = countBy(seedVisits);

function nowTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ClinicProvider({ children }) {
  const [state, setState] = useState(load);
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState([]);
  const [triageOpen, setTriageOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const notify = useCallback((message, tone = "info") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const addVisit = useCallback(
    (data) => {
      const visit = {
        ...data,
        id: `v${Date.now()}`,
        time: nowTime(),
        isNew: true,
      };
      setState((s) => ({ ...s, visits: [visit, ...s.visits] }));
      notify(`Triagem de ${data.name.split(" ")[0]} registrada.`, "success");
      return visit;
    },
    [notify]
  );

  const updateVisit = useCallback((id, patch) => {
    setState((s) => ({
      ...s,
      visits: s.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }, []);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const syncRnds = useCallback(() => {
    if (syncing) return Promise.resolve();
    setSyncing(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        const s = stateRef.current;
        const next = rndsQueue[s.rndsIndex];
        const lastSync = new Date().toISOString();
        if (next) {
          const visit = { ...next, id: `r${Date.now()}`, time: nowTime(), isNew: true, source: "RNDS" };
          setState({ ...s, visits: [visit, ...s.visits], rndsIndex: s.rndsIndex + 1, lastSync });
          notify(`RNDS sincronizada: ${next.name.split(" ")[0]} importado(a).`, "success");
        } else {
          setState({ ...s, lastSync });
          notify("RNDS sincronizada: nenhum registro novo.", "info");
        }
        setSyncing(false);
        resolve();
      }, 1400);
    });
  }, [syncing, notify]);

  const resetDemo = useCallback(() => {
    setState({ visits: seedVisits, rndsIndex: 0, lastSync: null });
    notify("Dados de demonstração restaurados.");
  }, [notify]);

  const stats = useMemo(() => {
    const { visits } = state;
    const counts = countBy(visits);
    const outcomes = {
      done: base.outcomes.done + counts.done - SEED_COUNTS.done,
      referred: base.outcomes.referred + counts.referred - SEED_COUNTS.referred,
      progress: base.outcomes.progress + counts.progress - SEED_COUNTS.progress,
    };
    const total = outcomes.done + outcomes.referred + outcomes.progress;
    const added = visits.length - seedVisits.length;

    const todayIndex = (new Date().getDay() + 6) % 7;
    const week = weekBase.map((v, i) => (i === todayIndex ? v + added : v));

    return {
      total,
      outcomes,
      waiting: counts.progress,
      resolutionPercent: total ? Math.round((outcomes.done / total) * 100) : 0,
      referralsToday: base.referralsToday + counts.referred - SEED_COUNTS.referred,
      urgentToday: visits.filter((v) => v.urgent).length,
      triageMinutes: base.triageMinutes,
      triageGoal: base.triageGoal,
      goalProgress: Math.min(total / base.monthGoal, 1),
      monthGoal: base.monthGoal,
      todayIndex,
      week,
    };
  }, [state]);

  const value = {
    visits: state.visits,
    lastSync: state.lastSync,
    rndsPending: rndsQueue.length - state.rndsIndex,
    stats,
    query,
    setQuery,
    toasts,
    notify,
    dismissToast,
    addVisit,
    updateVisit,
    syncRnds,
    syncing,
    resetDemo,
    triageOpen,
    openTriage: () => setTriageOpen(true),
    closeTriage: () => setTriageOpen(false),
    selectedId,
    openVisit: setSelectedId,
    closeVisit: () => setSelectedId(null),
  };

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}
