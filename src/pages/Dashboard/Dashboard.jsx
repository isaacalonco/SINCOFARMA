import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check, Stethoscope } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useClinic } from "../../contexts/clinic";
import KpiCards from "./components/KpiCards";
import WeeklyChart from "./components/WeeklyChart";
import OutcomeDonut from "./components/OutcomeDonut";
import VisitsTable from "../../components/VisitsTable";
import { rise, press } from "../../utils/motion";
import { unit } from "./data";

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
  const { stats, syncRnds, syncing, lastSync, rndsPending } = useClinic();
  const [justSynced, setJustSynced] = useState(false);

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
            <span className="sep">•</span>
            <span className="live-pill">
              <i />
              Plantão RT ativo
            </span>
          </motion.p>
          <motion.p className="unit" {...rise(3)}>{unit}</motion.p>
        </div>

        <motion.div className="page-actions" {...rise(2)}>
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
          <MotionLink to="/nova-triagem" className="btn btn--primary" {...press}>
            <span className="btn-shine" aria-hidden="true" />
            <Stethoscope size={16} />
            + Nova Triagem
          </MotionLink>
        </motion.div>
      </section>

      <KpiCards stats={stats} />

      <div className="charts-row">
        <WeeklyChart week={stats.week} todayIndex={stats.todayIndex} />
        <OutcomeDonut outcomes={stats.outcomes} />
      </div>

      <VisitsTable limit={5} showViewAll />
    </main>
  );
}
