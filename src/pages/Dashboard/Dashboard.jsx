import { useEffect, useState } from "react";
import { useDeferredMount } from "../../hooks/useDeferredMount";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check, Stethoscope, TriangleAlert, Store, EyeOff } from "lucide-react";
import { pode } from "../../services/permissoes";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import KpiCards from "./components/KpiCards";
import WeeklyChart from "./components/WeeklyChart";
import OutcomeDonut from "./components/OutcomeDonut";
import VisitsTable from "../../components/VisitsTable";
import Select from "../../components/Select";
import { rise, press } from "../../utils/motion";

const MotionLink = motion.create(Link);

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatSync(iso) {
  if (!iso) return "nunca sincronizado";
  const d = new Date(iso);
  return `última sync às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { stats, syncRnds, syncing, lastSync, rndsPending, unit, units, viewUnit, chooseUnit, patientDataHidden, historicAverage, status, loadError, reload } = useClinic();
  const seesAllUnits = pode(user, "ver_todas_unidades");
  const [justSynced, setJustSynced] = useState(false);
  // gráficos e tabela montam um quadro depois dos KPIs: a troca de página
  // fica leve e a parte de cima aparece de imediato
  const showCharts = useDeferredMount(2);
  const showTable = useDeferredMount(5);

  useEffect(() => {
    if (!justSynced) return;
    const t = setTimeout(() => setJustSynced(false), 1800);
    return () => clearTimeout(t);
  }, [justSynced]);

  async function handleSync() {
    if (syncing) return;
    await syncRnds();
    setJustSynced(true);
  }

  const syncState = syncing ? "syncing" : justSynced ? "done" : "idle";
  const syncLabel =
    syncState === "syncing" ? "Sincronizando..." : syncState === "done" ? "Sincronizado" : "Importar / RNDS Sync";

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Painel em Tempo Real</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Dashboard Clínico</motion.h1>
          <motion.p className="hello" {...rise(2)}>
            {greeting()}, {user?.name ?? "farmacêutico"}
            {user?.onDuty && (
              <>
                <span className="sep">•</span>
                <span className="live-pill">
                  <i />
                  Plantão RT ativo
                </span>
              </>
            )}
          </motion.p>
          {seesAllUnits && units.length > 0 ? (
            <motion.div {...rise(3)}>
              <Select
                className="unit-select"
                icon={Store}
                label="Farmácia"
                value={viewUnit ?? ""}
                onChange={chooseUnit}
                options={units.map((u) => ({ value: u.id, label: u.name }))}
              />
            </motion.div>
          ) : (
            <motion.p className="unit" {...rise(3)}>{unit}</motion.p>
          )}
        </div>

        <motion.div className="page-actions" {...rise(2)}>
          {pode(user, "sincronizar_rnds") && (
          <div className="sync-wrap">
            <motion.button
              className={`btn btn--ghost sync-${syncState}`}
              onClick={handleSync}
              disabled={syncing}
              aria-live="polite"
              layout
              {...(syncing ? {} : press)}
            >
              <span className="sync-icon">
                {syncState === "done" ? <Check size={16} /> : <RefreshCw size={16} />}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={syncLabel}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {syncLabel}
                </motion.span>
              </AnimatePresence>
              {rndsPending > 0 && syncState === "idle" && (
                <span className="sync-badge" title={`${rndsPending} registro(s) aguardando`}>
                  {rndsPending}
                </span>
              )}
            </motion.button>
            <small className="sync-meta">{formatSync(lastSync)}</small>
          </div>
          )}
          {pode(user, "criar_triagem") && (
            <MotionLink to="/nova-triagem" className="btn btn--primary" {...press}>
              <span className="btn-shine" aria-hidden="true" />
              <Stethoscope size={16} />
              + Nova Triagem
            </MotionLink>
          )}
        </motion.div>
      </section>

      {status === "error" && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{loadError}</span>
          <button type="button" className="btn btn--ghost" onClick={reload}>Tentar de novo</button>
        </div>
      )}

      <KpiCards stats={stats} loading={status === "loading"} />

      {showCharts && (
        <div className="charts-row">
          <WeeklyChart week={stats.week} todayIndex={stats.todayIndex} historicAverage={historicAverage} />
          <OutcomeDonut outcomes={stats.outcomes} />
        </div>
      )}

      {seesAllUnits && status === "ready" && units.length === 0 && (
        <div className="data-hidden" role="note">
          <Store size={18} aria-hidden="true" />
          <span>Nenhuma farmácia cadastrada ainda.</span>
        </div>
      )}

      {showTable &&
        (patientDataHidden ? (
          <div className="data-hidden" role="note">
            <EyeOff size={18} aria-hidden="true" />
            <span>
              <b>Dados de pacientes ocultos para este perfil.</b> A administração vê só os números da
              farmácia; nomes, CPF e queixas ficam com os farmacêuticos da unidade (LGPD).
            </span>
          </div>
        ) : (
          <VisitsTable limit={5} showViewAll />
        ))}
    </main>
  );
}
