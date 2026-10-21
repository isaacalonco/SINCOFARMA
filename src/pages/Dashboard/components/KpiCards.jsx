import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, Pill, PersonStanding, Timer } from "lucide-react";
import { useCountUp } from "./useCountUp";
import { useSpotlightTilt } from "../../../hooks/useSpotlightTilt";
import LightBeams from "../../../components/LightBeams";
import { EASE, pulse } from "../../../utils/motion";

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

export default function KpiCards({ stats }) {
  const visits = useCountUp(stats.total, { delay: 250 });
  const resolution = useCountUp(stats.resolutionPercent, { delay: 330 });
  const mip = useCountUp(stats.outcomes.done, { delay: 330 });
  const refs = useCountUp(stats.referralsToday, { delay: 410 });
  const minutes = useCountUp(stats.triageMinutes, { delay: 490 });
  const goalPct = Math.round(stats.goalProgress * 100);

  return (
    <section className="kpis">
      <KpiCard to="/atendimentos" index={0} className="kpi--primary kpi--link">
        <LightBeams className="beams--light" />
        <motion.span
          className="kpi-glow"
          aria-hidden="true"
          animate={{ opacity: [0.4, 0.85, 0.4], scale: [0.95, 1.05, 0.95] }}
          transition={pulse(5)}
        />
        <header className="kpi-head">
          <ClipboardCheck size={16} />
          <span>ATENDIMENTOS HOJE</span>
        </header>
        <div className="kpi-value-row">
          <strong className="kpi-value">{visits}</strong>
          <span className="kpi-caption">no mês<br />corrente</span>
          <span className="kpi-chip" title="Atendimentos em andamento">
            <span className="kpi-chip-dot" />
            {stats.waiting} em<br />espera
          </span>
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
          <strong className="kpi-value">{resolution}%</strong>
          <span className="kpi-caption">resolvidos em<br />consultório</span>
        </div>
        <div className="kpi-foot">
          <span>MIPs &amp;<br />Aconselhamento</span>
          <b className="tone-blue">{mip}<br />pacientes</b>
        </div>
      </KpiCard>

      <KpiCard to="/encaminhamentos" index={2} className="kpi--link">
        <header className="kpi-head">
          <span className="kpi-icon kpi-icon--navy"><PersonStanding size={16} /></span>
          <span>ENCAMINHAMENTOS<br />SES-DF</span>
        </header>
        <div className="kpi-value-row">
          <strong className="kpi-value">{refs}</strong>
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
          <strong className="kpi-value kpi-value--stack">{minutes}<br />min</strong>
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
