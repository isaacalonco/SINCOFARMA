import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicContext, SearchContext, ToastContext } from "./clinic";
import { repository } from "../data";
import { computeStats } from "../data/stats";
import { useOnline } from "../hooks/useOnline";
import { useAuth } from "./auth";
import { pode } from "../services/permissoes";

const EMPTY = {
  visits: [],
  lastSync: null,
  rndsPending: 0,
  baseline: { outcomes: { done: 0, referred: 0, progress: 0 }, referralsToday: 0, triageMinutes: 0, triageGoal: "", monthGoal: 0, seedCounts: { done: 0, referred: 0, progress: 0 }, seedCount: 0 },
  week: [0, 0, 0, 0, 0, 0, 0],
  historicAverage: 0,
  unit: "",
  todaySummary: null,
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
  const { user } = useAuth();
  const ownUnit = pode(user, "ver_atendimentos") && user?.unit ? user.unit : null;
  const seesAllUnits = pode(user, "ver_todas_unidades");
  // administração: lista de farmácias (null = ainda carregando) e a escolhida no painel
  const [units, setUnits] = useState(seesAllUnits ? null : []);
  const [chosenUnit, setChosenUnit] = useState(null);
  const viewUnit = chosenUnit ?? ownUnit;
  // fora da própria farmácia (ou sem papel que veja pacientes) o servidor manda só números
  const patientDataHidden = !ownUnit || viewUnit !== ownUnit;
  const canLoad = !!viewUnit;
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
    // sem farmácia para mostrar (médico; administração antes de escolher): nada a carregar
    const load = canLoad ? repository.loadDashboard(viewUnit === ownUnit ? undefined : viewUnit) : Promise.resolve({});
    // estados só mudam quando a promessa resolve (nada síncrono dentro do efeito)
    return load.then(
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
  }, [canLoad, viewUnit, ownUnit]);

  useEffect(() => {
    // administração: espera a lista de farmácias para saber qual mostrar
    if (units === null) return;
    fetchDashboard();
  }, [fetchDashboard, units]);

  // administração: carrega as farmácias e abre a primeira (quem também é farmacêutico abre a sua)
  useEffect(() => {
    if (!seesAllUnits) return;
    repository.listUnits().then(
      (list) => {
        if (!alive.current) return;
        setUnits(list);
        if (!ownUnit && list.length) setChosenUnit((c) => c ?? list[0].id);
      },
      (err) => {
        if (!alive.current) return;
        setUnits([]);
        setLoadError(friendly(err, "Não foi possível carregar as farmácias."));
        setStatus("error");
      }
    );
  }, [seesAllUnits, ownUnit]);

  const chooseUnit = useCallback((id) => {
    setStatus("loading");
    setLoadError(null);
    setChosenUnit(id);
  }, []);

  const load = useCallback(() => {
    setStatus("loading");
    setLoadError(null);
    return fetchDashboard();
  }, [fetchDashboard]);

  /* ---------- operações ---------- */
  const addVisit = useCallback(
    async (payload, clinical = null) => {
      if (!online) {
        notify("Sem conexão: o atendimento não foi registrado.", "error");
        throw new Error("offline");
      }
      try {
        const visit = await repository.createVisit(payload, clinical);
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
  const stats = useMemo(() => {
    const s = computeStats(data.visits, { baseline: data.baseline, week: data.week });
    // sem a lista de pacientes, os números de hoje vêm prontos do servidor
    const t = data.todaySummary;
    return patientDataHidden && t ? { ...s, todayTotal: t.total, waiting: t.progress, urgentToday: t.urgent } : s;
  }, [data.visits, data.baseline, data.week, data.todaySummary, patientDataHidden]);

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
      units: units ?? [],
      viewUnit,
      chooseUnit,
      patientDataHidden,
      historicAverage: data.historicAverage,
      stats,
      notify,
      addVisit,
      updateVisit,
      syncRnds,
      syncing,
      resetDemo,
      selectedId,
      openVisit,
      closeVisit,
    }),
    [status, loadError, load, online, data, units, viewUnit, chooseUnit, patientDataHidden, stats, notify, addVisit, updateVisit, syncRnds, syncing, resetDemo, selectedId, openVisit, closeVisit]
  );
  const search = useMemo(() => ({ query, setQuery }), [query]);
  const toastValue = useMemo(() => ({ toasts, dismissToast }), [toasts, dismissToast]);

  return (
    <ClinicContext.Provider value={value}>
      <SearchContext.Provider value={search}>
        <ToastContext.Provider value={toastValue}>{children}</ToastContext.Provider>
      </SearchContext.Provider>
    </ClinicContext.Provider>
  );
}
