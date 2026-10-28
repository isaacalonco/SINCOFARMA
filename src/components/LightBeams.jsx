import "./LightBeams.css";

/**
 * Feixes de luz percorrendo a borda de um card (login e KPI principal).
 * Animação 100% em CSS (transform + opacity): roda no compositor, sem
 * custo de JavaScript por quadro.
 */
export default function LightBeams({ className = "" }) {
  return (
    <div className={`beams ${className}`} aria-hidden="true">
      <span className="beam beam--top" />
      <span className="beam beam--right" />
      <span className="beam beam--bottom" />
      <span className="beam beam--left" />
      <span className="corner corner--tl" />
      <span className="corner corner--tr" />
      <span className="corner corner--br" />
      <span className="corner corner--bl" />
    </div>
  );
}
