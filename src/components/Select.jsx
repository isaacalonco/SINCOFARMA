import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

const ROW = 38; // altura de cada opção (px), para decidir abrir para cima ou para baixo
const MAX = 300;

/**
 * Seleção com lista no visual do painel (no lugar do <select> nativo).
 * - options: [{ value, label, disabled? }]
 * - className define a aparência do botão: "btn-filter", "sel--field", "sel--bare", "unit-select"...
 * - label: nome acessível quando não há <label> visível ligado pelo id.
 * O foco fica sempre no botão (a lista usa aria-activedescendant), então funciona dentro
 * de modais com foco preso. A lista abre num portal: não é cortada por cartões com overflow.
 */
export default function Select({
  value,
  onChange,
  options,
  icon: Icon,
  className = "",
  placeholder = "Selecione",
  label,
  id,
  disabled,
  ...aria
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const list = useRef(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const selected = options.findIndex((o) => o.value === value);
  const current = options[selected];

  function openList() {
    const r = btn.current.getBoundingClientRect();
    const height = Math.min(options.length * ROW + 12, MAX);
    const below = window.innerHeight - r.bottom;
    const up = below < height + 12 && r.top > below;
    setPos({
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8),
      width: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
    });
    setActive(selected >= 0 ? selected : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }

  function close(focus = true) {
    setOpen(false);
    if (focus) btn.current?.focus();
  }

  function choose(i) {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  }

  function move(from, step) {
    for (let i = from + step; i >= 0 && i < options.length; i += step) {
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(e) {
    const k = e.key;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (k === "Escape") {
      // fecha só a lista, não o modal em volta
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (k === "ArrowDown") {
      e.preventDefault();
      setActive((a) => move(a, 1));
    } else if (k === "ArrowUp") {
      e.preventDefault();
      setActive((a) => move(a, -1));
    } else if (k === "Home") {
      e.preventDefault();
      setActive(move(-1, 1));
    } else if (k === "End") {
      e.preventDefault();
      setActive(move(options.length, -1));
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      choose(active);
    } else if (k === "Tab") {
      close(false);
    } else if (k.length === 1 && /\S/.test(k)) {
      // digitar as primeiras letras pula para a opção
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + k.toLowerCase(), at: now };
      const hit = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  // fecha ao clicar fora, rolar a página ou mudar o tamanho da janela
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => {
      if (!btn.current?.contains(e.target) && !list.current?.contains(e.target)) close(false);
    };
    const scroll = (e) => {
      if (!list.current?.contains(e.target)) close(false);
    };
    const resize = () => close(false);
    document.addEventListener("mousedown", outside);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  // mantém a opção ativa visível
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  return (
    <>
      <button
        ref={btn}
        id={id}
        type="button"
        className={`sel ${className}${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={label ? `${label}: ${current?.label ?? placeholder}` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        disabled={disabled}
        {...aria}
      >
        {Icon && <Icon size={14} aria-hidden="true" />}
        <span className={`sel-value${current ? "" : " is-placeholder"}`}>{current?.label ?? placeholder}</span>
        <ChevronDown size={15} className="chev" aria-hidden="true" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label={label}
              className="sel-pop"
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: Math.max(pos.width, 180) }}
              initial={{ opacity: 0, y: pos.top != null ? -6 : 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              onMouseDown={(e) => e.preventDefault()} // o foco continua no botão
            >
              {options.map((o, i) => (
                // teclado tratado no botão (aria-activedescendant); o clique é só para o mouse
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === selected}
                  aria-disabled={o.disabled || undefined}
                  className={`${i === active ? "is-active" : ""}${i === selected ? " is-selected" : ""}`}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span>{o.label}</span>
                  {i === selected && <Check size={15} aria-hidden="true" />}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
