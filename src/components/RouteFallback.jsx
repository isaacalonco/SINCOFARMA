/** Indicador discreto enquanto o código de uma página é baixado. */
export default function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback-bar" aria-hidden="true" />
      <span className="sr-only">Carregando página…</span>
    </div>
  );
}
