import { useState } from "react";
import { Info } from "lucide-react";
import SpotlightCard from "../../../components/SpotlightCard";
import { WEEK_LABELS, WEEK_NAMES } from "../../../data/catalog";

const STEP = 7;

export default function WeeklyChart({ week, todayIndex, historicAverage = 17 }) {
  const [hover, setHover] = useState(null);

  const max = Math.max(28, Math.ceil(Math.max(...week) / STEP) * STEP);
  const ticks = Array.from({ length: max / STEP + 1 }, (_, i) => max - i * STEP);
  // só dias já ocorridos contam como registro; os demais são previsão
  const recorded = week.slice(0, todayIndex + 1);
  const total = recorded.reduce((s, v) => s + v, 0);
  const peakIndex = recorded.indexOf(Math.max(...recorded));

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

      <div className="bars" role="group" aria-label="Triagens por dia da semana">
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
                onFocus={() => setHover(idx)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${WEEK_NAMES[idx]}: ${value} ${isFuture ? "previstas" : "triagens"}, ${diff >= 0 ? "+" : ""}${diff} em relação à média`}
              >
                <div className="bar-track">
                  <div
                    className={`bar bar--${tone}`}
                    style={{ "--h": value / max, "--d": `${550 + idx * 70}ms` }}
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
                  </div>
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
          <Info size={14} /> Média histórica da unidade: {historicAverage} triagens por dia.
        </span>
        <b>Total: {total} triagens registradas até hoje</b>
      </footer>
    </SpotlightCard>
  );
}
