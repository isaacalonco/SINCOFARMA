import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, Pill, PersonStanding, Timer } from "lucide-react";
import CountUp from "../../../components/CountUp";
import { useSpotlightTilt } from "../../../hooks/useSpotlightTilt";
import LightBeams from "../../../components/LightBeams";
import { EASE } from "../../../utils/motion";
import { isReady } from "../../../config/app";

const MotionLink = motion.create(Link);

/** Card de KPI: entra em cascata, inclina em 3D e tem holofote no hover. */
function KpiCard({ to, index, className = "", children }) {
  const { handlers, style } = useSpotlightTilt(6);
  const props = {
    className: `kpi spotlight ${className}`,
    style,
    ...handlers,
    initial: { opacity: 0, y: 22, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { delay: 0.12 + index * 0.08, duration: 0.65, ease: EASE },
    whileHover: { y: -4, transition: { type: "spring", stiffness: 300, damping: 20 } },
    whileTap: to ? { scale: 0.98 } : undefined,
  };
  return to ? (
    <MotionLink to={to} {...props}>
      {children}
    </MotionLink>
  ) : (
    <motion.article {...props}>{children}</motion.article>
  );
}

export default function KpiCards({ stats, loading = false }) {
  const goalPct = Math.round(stats.goalProgress * 100);

  return (
    <section className={`kpis${loading ? " is-loading" : ""}`} aria-busy={loading}>
      <KpiCard to={isReady("/atendimentos") ? "/atendimentos" : undefined} index={0} className={`kpi--primary${isReady("/atendimentos") ? " kpi--link" : ""}`}>
        <LightBeams className="beams--light" />
        <span className="kpi-glow" aria-hidden="true" />
        <header className="kpi-head">
          <ClipboardCheck size={16} />
          <span>ATENDIMENTOS HOJE</span>
        </header>
        <div className="kpi-value-row">
          <strong className="kpi-value"><CountUp value={stats.todayTotal} delay={300} /></strong>
          <span className="kpi-caption">registrados<br />hoje</span>
          <span className="kpi-chip" title="Atendimentos em andamento">
            <span className="kpi-chip-dot" />
            {stats.waiting} em<br />espera
          </span>
        </div>
        <div className="kpi-month">
          <span>Mês corrente</span>
          <b><CountUp value={stats.monthTotal} delay={300} /> / {stats.monthGoal}</b>
        </div>
        <div
          className="kpi-progress"
          role="progressbar"
          aria-label={`Meta mensal: ${goalPct}% de ${stats.monthGoal}`}
          title={`${goalPct}% da meta mensal (${stats.monthGoal})`}
          aria-valuenow={goalPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: stats.goalProgress }}
            transition={{ delay: 0.5, duration: 1.2, ease: EASE }}
          />
        </div>
      </KpiCard>

      <KpiCard index={1}>
        <header className="kpi-head">
          <span className="kpi-icon kpi-icon--blue"><Pill size={16} /></span>
          <span>RESOLUÇÃO LOCAL</span>
        </header>
        <div className="kpi-value-row">
          <strong className="kpi-value"><CountUp value={stats.resolutionPercent} delay={380} suffix="%" /></strong>
          <span className="kpi-caption">resolvidos em<br />consultório</span>
        </div>
        <div className="kpi-foot">
          <span>MIPs &amp;<br />Aconselhamento</span>
          <b className="tone-blue"><CountUp value={stats.outcomes.done} delay={380} /><br />pacientes</b>
        </div>
      </KpiCard>

      <KpiCard to={isReady("/encaminhamentos") ? "/encaminhamentos" : undefined} index={2} className={isReady("/encaminhamentos") ? "kpi--link" : ""}>
        <header className="kpi-head">
          <span className="kpi-icon kpi-icon--navy"><PersonStanding size={16} /></span>
          <span>ENCAMINHAMENTOS<br />SES-DF</span>
        </header>
        <div className="kpi-value-row">
          <strong className="kpi-value"><CountUp value={stats.referralsToday} delay={460} /></strong>
          <span className="kpi-caption">para UBS / UPA / HRAN</span>
        </div>
        <div className="kpi-foot">
          <span>Fila Regulada<br />via RNDS</span>
          {stats.urgentToday > 0 ? (
            <b className="tone-red">
              <span className="pulse-dot" />
              {stats.urgentToday} {stats.urgentToday === 1 ? "urgente" : "urgentes"}
              <br />(Red Flag)
            </b>
          ) : (
            <b>Sem<br />urgências</b>
          )}
        </div>
      </KpiCard>

      <KpiCard index={3}>
        <header className="kpi-head">
          <span className="kpi-icon kpi-icon--slate"><Timer size={16} /></span>
          <span>TEMPO MÉDIO TRIAGEM</span>
        </header>
        <div className="kpi-value-row">
          <strong className="kpi-value kpi-value--stack">
            {stats.triageMinutes > 0 ? <CountUp value={stats.triageMinutes} delay={540} /> : <span title="Ainda sem triagens medidas neste mês">–</span>}
            <br />min
          </strong>
          <span className="kpi-caption">protocolo<br />Manchester</span>
        </div>
        <div className="kpi-foot">
          <span>Acolhimento<br />farmacêutico</span>
          <b>{stats.triageGoal}<br />meta</b>
        </div>
      </KpiCard>
    </section>
  );
}
