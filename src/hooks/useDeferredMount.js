import { useEffect, useState } from "react";

/**
 * Retorna false no primeiro quadro e true logo depois. Serve para montar
 * partes pesadas da página (gráficos, tabelas) fora do quadro em que a
 * transição de rota acontece.
 */
export function useDeferredMount(frames = 2) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let raf;
    let n = frames;
    const step = () => {
      if (--n <= 0) setReady(true);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // aba em segundo plano não dispara quadros: garante a montagem mesmo assim
    const fallback = setTimeout(() => setReady(true), 120);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [frames]);
  return ready;
}
