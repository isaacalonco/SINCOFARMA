import { useCallback, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { MotionPrefsContext } from "./motionPrefsContext";

const KEY = "sinco:motion";
const MODES = ["auto", "full", "reduced"];

function readSaved() {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

function systemReduced() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Preferência de movimento com três modos:
 *  - auto: segue o sistema operacional (prefers-reduced-motion);
 *  - full: anima sempre (útil em máquinas com animações do SO desligadas);
 *  - reduced: reduz sempre.
 * Aplica `data-motion` no <html> (para o CSS) e configura o framer-motion.
 */
export function MotionPrefsProvider({ children }) {
  const [mode, setMode] = useState(readSaved);
  const [sysReduced, setSysReduced] = useState(systemReduced);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const onChange = (e) => setSysReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const reduced = mode === "reduced" || (mode === "auto" && sysReduced);

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? "reduce" : "full";
  }, [reduced]);

  const cycle = useCallback(() => {
    setMode((m) => {
      const next = MODES[(MODES.indexOf(m) + 1) % MODES.length];
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* sem armazenamento: vale só para a sessão */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ mode, reduced, sysReduced, cycle }), [mode, reduced, sysReduced, cycle]);

  return (
    <MotionPrefsContext.Provider value={value}>
      <MotionConfig reducedMotion={reduced ? "always" : "never"}>{children}</MotionConfig>
    </MotionPrefsContext.Provider>
  );
}
