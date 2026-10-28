import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Prende o foco dentro de `ref` enquanto `active` for true:
 * - move o foco para o primeiro elemento focável ao abrir;
 * - Tab e Shift+Tab circulam só dentro do container;
 * - Escape chama `onClose`;
 * - ao fechar, devolve o foco ao elemento que estava focado antes.
 */
export function useFocusTrap(ref, active, { onClose, initialFocus } = {}) {
  // a função de fechar pode mudar a cada render do pai; guardada em ref para
  // não desmontar/remontar a captura de foco enquanto o diálogo está aberto
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return undefined;
    const container = ref.current;
    if (!container) return undefined;
    const previous = document.activeElement;

    const focusables = () => [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);

    // foco inicial (um instante depois, quando o diálogo já está no DOM e visível;
    // timer em vez de requestAnimationFrame porque abas ocultas não produzem quadros)
    const focusTimer = setTimeout(() => {
      const target = (initialFocus && container.querySelector(initialFocus)) || focusables()[0] || container;
      target.focus({ preventScroll: true });
    }, 30);

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      // devolve o foco depois que o fundo deixou de ser inerte (cleanup síncrono do outro hook)
      if (previous && typeof previous.focus === "function") {
        setTimeout(() => previous.isConnected && previous.focus({ preventScroll: true }), 0);
      }
    };
  }, [ref, active, initialFocus]);
}

/** Bloqueia a rolagem do body e marca o resto da página como inerte. */
export function useModalBackdrop(active, exceptSelector) {
  useEffect(() => {
    if (!active) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // marca como inerte tudo que não contém o diálogo; desce na árvore
    // só pelos ramos que contêm o diálogo, para inertizar os irmãos dele
    const inertTargets = [];
    const mark = (parent) => {
      [...parent.children].forEach((el) => {
        if (el.tagName === "SCRIPT" || el.tagName === "STYLE") return;
        if (exceptSelector && el.matches(exceptSelector)) return;
        if (exceptSelector && el.querySelector(exceptSelector)) {
          mark(el);
          return;
        }
        if (!el.hasAttribute("inert")) {
          el.setAttribute("inert", "");
          inertTargets.push(el);
        }
      });
    };
    mark(document.body);
    return () => {
      document.body.style.overflow = prevOverflow;
      inertTargets.forEach((el) => el.removeAttribute("inert"));
    };
  }, [active, exceptSelector]);
}
