import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_KEY = "sinco:activity";
const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"];
const WRITE_EVERY = 5000; // grava a última atividade no máximo a cada 5s

function readShared() {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeShared(t) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(t));
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
}

/**
 * Encerra a sessão após `timeoutMs` sem interação. Avisa `warnMs` antes.
 * A última atividade é compartilhada entre abas (localStorage), então usar
 * o painel em outra aba mantém esta viva.
 * Durante o aviso, só o botão "continuar" (stayActive) renova a sessão.
 */
export function useIdleTimeout({ enabled = true, timeoutMs, warnMs, onTimeout }) {
  const [remaining, setRemaining] = useState(timeoutMs);
  const last = useRef(0);
  const lastWrite = useRef(0);
  const warning = enabled && remaining <= warnMs;
  const warningRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);
  useEffect(() => {
    warningRef.current = warning;
  }, [warning]);

  const mark = useCallback(() => {
    const now = Date.now();
    last.current = now;
    if (now - lastWrite.current > WRITE_EVERY) {
      lastWrite.current = now;
      writeShared(now);
    }
  }, []);

  const stayActive = useCallback(() => {
    lastWrite.current = 0;
    mark();
    setRemaining(timeoutMs);
  }, [mark, timeoutMs]);

  useEffect(() => {
    if (!enabled) return undefined;
    last.current = Date.now();
    writeShared(last.current);

    const onActivity = () => {
      if (!warningRef.current) mark();
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    let fired = false;
    const tick = setInterval(() => {
      const lastSeen = Math.max(last.current, readShared());
      const left = timeoutMs - (Date.now() - lastSeen);
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        onTimeoutRef.current?.();
      }
    }, 1000);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(tick);
    };
  }, [enabled, timeoutMs, mark]);

  return { warning, remaining: Math.max(remaining, 0), stayActive };
}
