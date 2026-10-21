import { useState } from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import SpotlightCard from "../../../components/SpotlightCard";
import { WEEK_LABELS, WEEK_NAMES, historicAverage } from "../data";

const STEP = 7;

export default function WeeklyChart({ week, todayIndex }) {
  const [hover, setHover] = useState(null);

  const max = Math.max(28, Math.ceil(Math.max(...week) / STEP) * STEP);
  const ticks = Array.from({ length: max / STEP + 1 }, (_, i) => max - i * STEP);
  const total = week.reduce((s, v) => s + v, 0);
  const peakIndex = week.indexOf(Math.max(...week));

  return (
    <SpotlightCard index={4} className="chart-card">
      <header className="card-head">
        <div>
          <h2>Volume de Atendimentos da Semana</h2>
          <p>
            Distribuição diária de triagens com pico operacional identificado
            na {WEEK_NAMES[peakIndex]}
          </p>
        </div>
        <ul className="legend">
          <li><i className="dot dot--teal" />Triagem<br />Farmacêutica</li>
          <li><i className="dot dot--ghost" />Média<br />Histórica</li>
        </ul>
      </header>

      <div
        className="bars"
        role="img"
        aria-label={`Triagens por dia: ${week.map((v, i) => `${WEEK_LABELS[i]} ${v}`).join(", ")}`}
      >
        <div className="bars-grid">
          {ticks.map((t) => (
            <div key={t} className="bars-tick" style={{ "--y": t / max }}>
              <span>{t}</span>
            </div>
          ))}
          <div className="bars-avg" style={{ "--y": historicAverage / max }}>
            <span>média {historicAverage}</span>
          </div>
        </div>

        <div className="bars-cols">
          {week.map((value, idx) => {
            const isToday = idx === todayIndex;
            const isFuture = idx > todayIndex;
            const tone = idx < todayIndex ? "past" : isToday ? "today" : `future-${Math.min(idx - todayIndex, 3)}`;
            const diff = value - historicAverage;
            return (
              <div
                key={WEEK_LABELS[idx]}
                className={`bar-col${hover === idx ? " is-hover" : ""}${
                  hover !== null && hover !== idx ? " is-dim" : ""
                }`}
                onMouseEnter={() => setHover(idx)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="bar-track">
                  <motion.div
                    className={`bar bar--${tone}`}
                    style={{ "--h": value / max }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.55 + idx * 0.07 }}
                  >
                    {(isToday || idx === peakIndex) && (
                      <span className={`bar-peak${isToday ? "" : " bar-peak--muted"}`}>{value}</span>
                    )}
                    <span className="bar-tip">
                      <b>{value}</b> {isFuture ? "previstas" : "triagens"}
                      <small>
                        {WEEK_NAMES[idx]} · {diff >= 0 ? `+${diff}` : diff} vs média
                      </small>
                    </span>
                  </motion.div>
                </div>
                <span className={`bar-label${isToday ? " is-today" : ""}`}>
                  {isToday ? `${WEEK_LABELS[idx]} · Hoje` : WEEK_LABELS[idx]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <footer className="chart-foot">
        <span>
          <Info size={14} /> Sincronização contínua com banco de dados regional (SES-DF).
        </span>
        <b>Total: {total} triagens registradas</b>
      </footer>
    </SpotlightCard>
  );
}
