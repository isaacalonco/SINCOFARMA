import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import SpotlightCard from "../../../components/SpotlightCard";
import { EASE } from "../../../utils/motion";
import { OUTCOME_META } from "../../../data/catalog";
import { monthLabel } from "../../../utils/dates";
import { isReady } from "../../../config/app";
import CountUp from "../../../components/CountUp";

const R = 62;
const C = 2 * Math.PI * R;
const GAP = 4;
const ORDER = ["done", "referred", "progress"];

function buildSegments(outcomes) {
  const total = ORDER.reduce((s, k) => s + outcomes[k], 0) || 1;
  const out = [];
  let offset = 0;
  ORDER.forEach((key, idx) => {
    const count = outcomes[key];
    const len = (count / total) * C;
    out.push({
      key,
      idx,
      count,
      percent: Math.round((count / total) * 100),
      len: Math.max(len - GAP, 0),
      offset,
      ...OUTCOME_META[key],
    });
    offset += len;
  });
  return out;
}

export default function OutcomeDonut({ outcomes }) {
  const [active, setActive] = useState(null);
  const segments = buildSegments(outcomes);
  const current = segments.find((s) => s.key === active) ?? segments[0];

  return (
    <SpotlightCard index={5} className="donut-card">
      <header className="card-head">
        <div>
          <h2>Desfechos Clínicos</h2>
          <p>Eficiência de condutas farmacoterapêuticas</p>
        </div>
        <span className="period-pill">{monthLabel()}</span>
      </header>

      <div className="donut-wrap">
        <svg
          viewBox="0 0 160 160"
          className="donut"
          role="img"
          aria-label={`Desfechos: ${segments.map((s) => `${s.label} ${s.percent}%`).join(", ")}`}
        >
          <circle cx="80" cy="80" r={R} className="donut-bg" />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx="80"
              cy="80"
              r={R}
              className={`donut-seg${active && active !== s.key ? " is-dim" : ""}${
                active === s.key ? " is-active" : ""
              }`}
              stroke={s.color}
              style={{
                strokeDasharray: `${s.len} ${C}`,
                strokeDashoffset: -s.offset,
                "--d": `${300 + s.idx * 180}ms`,
              }}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <motion.div
          className="donut-center"
          key={active ?? "default"}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <strong><CountUp value={current.percent} delay={300} duration={900} suffix="%" /></strong>
          <span>{active ? current.label : "RESOLUÇÃO"}</span>
        </motion.div>
      </div>

      <ul className="donut-legend">
        {segments.map((s, i) => (
          <motion.li
            key={s.key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: active === s.key ? 4 : 0 }}
            transition={{ delay: active === null ? 0.7 + i * 0.08 : 0, duration: 0.5, ease: EASE }}
            className={active === s.key ? "is-active" : active ? "is-dim" : ""}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(s.key)}
            onBlur={() => setActive(null)}
            style={{ "--c": s.color }}
          >
            {(() => {
              const to = s.key === "referred" ? "/encaminhamentos" : "/atendimentos";
              const inner = (
                <>
                  <i className="sq" />
                  <span>{s.label}</span>
                  <b>{s.percent}%</b>
                  <small>({s.count})</small>
                </>
              );
              const label = `${s.label}: ${s.percent}%, ${s.count} atendimentos`;
              return isReady(to) ? (
                <Link to={to} className="legend-link" aria-label={label}>{inner}</Link>
              ) : (
                <button
                  type="button"
                  className="legend-link"
                  aria-label={label}
                  aria-pressed={active === s.key}
                  onClick={() => setActive((a) => (a === s.key ? null : s.key))}
                >
                  {inner}
                </button>
              );
            })()}
          </motion.li>
        ))}
      </ul>
    </SpotlightCard>
  );
}
