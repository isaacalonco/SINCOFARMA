import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicContext } from "./clinic";
import { repository } from "../data";
import { computeStats } from "../data/stats";
import { useOnline } from "../hooks/useOnline";

const EMPTY = {
  visits: [],
  lastSync: null,
  rndsPending: 0,
  baseline: { outcomes: { done: 0, referred: 0, progress: 0 }, referralsToday: 0, triageMinutes: 0, triageGoal: "", monthGoal: 0, seedCounts: { done: 0, referred: 0, progress: 0 }, seedCount: 0 },
  week: [0, 0, 0, 0, 0, 0, 0],
  historicAverage: 0,
  unit: "",
};

const friendly = (err, fallback) => (err?.message && err.message !== "Failed to fetch" ? err.message : fallback);

/**
 * Estado clínico do app. Toda leitura/escrita passa pelo `repository`
 * (mock ou API). Mantém: dados do painel, status de carga/erro, busca,
 * avisos e o painel de detalhes.
 */
export function ClinicProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const online = useOnline();
  const toastId = useRef(0);
  const timers = useRef(new Set());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach(clearTimeout);
    };
  }, []);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      if (alive.current) fn();
    }, ms);
    timers.current.add(id);
  }, []);

  const notify = useCallback(
    (message, tone = "info") => {
      toastId.current += 1;
      const id = toastId.current;
      setToasts((t) => [...t, { id, message, tone }]);
      later(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3800);
    },
    [later]
  );
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /* ---------- carga inicial / recarga ---------- */
  const fetchDashboard = useCallback(() => {
    // estados só mudam quando a promessa resolve (nada síncrono dentro do efeito)
    return repository.loadDashboard().then(
      (result) => {
        if (!alive.current) return;
        setData({ ...EMPTY, ...result });
        setStatus("ready");
      },
      (err) => {
        if (!alive.current) return;
        setLoadError(friendly(err, "Não foi possível carregar o painel."));
        setStatus("error");
      }
    );
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const load = useCallback(() => {
    setStatus("loading");
    setLoadError(null);
    return fetchDashboard();
  }, [fetchDashboard]);

  /* ---------- operações ---------- */
  const addVisit = useCallback(
    async (payload) => {
      if (!online) {
        notify("Sem conexão: o atendimento não foi registrado.", "error");
        throw new Error("offline");
      }
      try {
        const visit = await repository.createVisit(payload);
        setData((d) => ({ ...d, visits: [visit, ...d.visits] }));
        notify(`Triagem de ${payload.name.split(" ")[0]} registrada.`, "success");
        return visit;
      } catch (err) {
        notify(friendly(err, "Falha ao registrar a triagem."), "error");
        throw err;
      }
    },
    [notify, online]
  );

  const updateVisit = useCallback(
    async (id, patch) => {
      // otimista: aplica já e desfaz se o servidor recusar
      let previous;
      setData((d) => {
        previous = d.visits.find((v) => v.id === id);
        return { ...d, visits: d.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
      });
      try {
        const updated = await repository.updateVisit(id, patch);
        setData((d) => ({ ...d, visits: d.visits.map((v) => (v.id === id ? { ...v, ...updated } : v)) }));
        return updated;
      } catch (err) {
        if (previous) setData((d) => ({ ...d, visits: d.visits.map((v) => (v.id === id ? previous : v)) }));
        notify(friendly(err, "Não foi possível salvar a alteração."), "error");
        throw err;
      }
    },
    [notify]
  );

  const syncRnds = useCallback(async () => {
    if (syncing) return;
    if (!online) {
      notify("Sem conexão com a RNDS.", "error");
      return;
    }
    setSyncing(true);
    try {
      const { imported, lastSync, rndsPending } = await repository.syncRnds();
      if (!alive.current) return;
      setData((d) => ({
        ...d,
        visits: imported ? [imported, ...d.visits] : d.visits,
        lastSync,
        rndsPending,
      }));
      notify(
        imported ? `RNDS sincronizada: ${imported.name.split(" ")[0]} importado(a).` : "RNDS sincronizada: nenhum registro novo.",
        imported ? "success" : "info"
      );
    } catch (err) {
      notify(friendly(err, "Falha na sincronização com a RNDS."), "error");
    } finally {
      if (alive.current) setSyncing(false);
    }
  }, [syncing, online, notify]);

  const resetDemo = useCallback(async () => {
    try {
      const result = await repository.reset();
      setData({ ...EMPTY, ...result });
      notify("Dados de demonstração restaurados.");
    } catch (err) {
      notify(friendly(err, "Não foi possível restaurar."), "error");
    }
  }, [notify]);

  /* ---------- derivados ---------- */
  const stats = useMemo(
    () => computeStats(data.visits, { baseline: data.baseline, week: data.week }),
    [data.visits, data.baseline, data.week]
  );

  const openVisit = useCallback((id) => setSelectedId(id), []);
  const closeVisit = useCallback(() => setSelectedId(null), []);

  const value = useMemo(
    () => ({
      status,
      loadError,
      reload: load,
      online,
      visits: data.visits,
      lastSync: data.lastSync,
      rndsPending: data.rndsPending,
      unit: data.unit,
      historicAverage: data.historicAverage,
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
      selectedId,
      openVisit,
      closeVisit,
    }),
    [status, loadError, load, online, data, stats, query, toasts, notify, dismissToast, addVisit, updateVisit, syncRnds, syncing, resetDemo, selectedId, openVisit, closeVisit]
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}
