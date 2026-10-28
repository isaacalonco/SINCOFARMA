import { useEffect, useRef } from "react";

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Número que anima do valor anterior até `value` escrevendo direto no DOM.
 * Não dispara re-render do React a cada quadro (antes, cinco contadores
 * re-renderizavam o bloco de KPIs 60 vezes por segundo).
 */
export default function CountUp({ value, delay = 0, duration = 1100, suffix = "", className }) {
  const ref = useRef(null);
  const current = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const from = current.current;
    const wait = first.current ? delay : 0;
    const dur = first.current ? duration : 600;
    first.current = false;
    let raf;
    let start;
    const tick = (now) => {
      if (start === undefined) start = now + wait;
      const t = Math.min(Math.max((now - start) / dur, 0), 1);
      const n = Math.round(from + (value - from) * easeOut(t));
      if (n !== current.current || t === 1) {
        current.current = n;
        el.textContent = `${n}${suffix}`;
      }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // sem quadros (aba oculta), mostra o valor final no fim do tempo previsto
    const fallback = setTimeout(() => {
      cancelAnimationFrame(raf);
      current.current = value;
      el.textContent = `${value}${suffix}`;
    }, wait + dur + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [value, delay, duration, suffix]);

  return (
    <span ref={ref} className={className} aria-live="off">
      0{suffix}
    </span>
  );
}
