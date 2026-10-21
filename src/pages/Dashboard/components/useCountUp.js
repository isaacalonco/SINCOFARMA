import { useEffect, useRef, useState } from "react";

/** Anima um número do valor atual até `target` (começa do zero na montagem). */
export function useCountUp(target, { duration = 1100, delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    let raf;
    let start;
    const from = fromRef.current;
    const wait = firstRun.current ? delay : 0;
    const dur = firstRun.current ? duration : 600;
    firstRun.current = false;

    const tick = (now) => {
      if (start === undefined) start = now + wait;
      const t = Math.min(Math.max((now - start) / dur, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (target - from) * eased);
      fromRef.current = current;
      setValue(current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);

  return value;
}
