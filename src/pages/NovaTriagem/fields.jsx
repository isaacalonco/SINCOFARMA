// Campos do formulário de triagem, com rótulo e erro ligados por ARIA.
import { Children, cloneElement, isValidElement, useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { EASE, SPRING } from "../../utils/motion";

const CONTROL_TAGS = new Set(["input", "select", "textarea"]);
const shake = { x: [0, -6, 6, -4, 4, 0] };

function FieldError({ id, error }) {
  return (
    <AnimatePresence initial={false}>
      {error && (
        <motion.span
          id={id}
          className="tg-field-error"
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          {error}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Foca o controle ao clicar em qualquer ponto do cartão do campo (conveniência de mouse). */
function focusControl(e) {
  if (e.target === e.currentTarget || e.target.classList?.contains("tg-unit")) {
    e.currentTarget.querySelector("input, select, textarea")?.focus();
  }
}

/**
 * Campo com um controle. O primeiro <input>/<select>/<textarea> filho recebe
 * id, aria-invalid e aria-describedby (apontando para a mensagem de erro).
 */
export function Field({ label, invalid, error, className = "", children }) {
  const id = useId();
  const errId = `${id}-err`;
  const items = Children.toArray(children);
  const controlIndex = items.findIndex((c) => isValidElement(c) && CONTROL_TAGS.has(c.type));
  const showError = invalid && !!error;

  return (
    <motion.div
      className={`tg-field ${invalid ? "is-invalid" : ""} ${className}`}
      animate={invalid ? shake : { x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={focusControl}
    >
      <label className="tg-label" htmlFor={id}>{label}</label>
      {items.map((c, i) =>
        i === controlIndex
          ? cloneElement(c, {
              id,
              "aria-invalid": invalid || undefined,
              "aria-describedby": showError ? errId : undefined,
            })
          : c
      )}
      <FieldError id={errId} error={showError ? error : null} />
    </motion.div>
  );
}

/**
 * Campo com vários controles (ex.: pressão sistólica/diastólica).
 * Vira um grupo rotulado; cada controle mantém seu próprio aria-label.
 */
export function FieldGroup({ label, invalid, error, className = "", children }) {
  const id = useId();
  const labelId = `${id}-label`;
  const errId = `${id}-err`;
  const showError = invalid && !!error;
  return (
    <motion.div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={showError ? errId : undefined}
      className={`tg-field ${invalid ? "is-invalid" : ""} ${className}`}
      animate={invalid ? shake : { x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onClick={focusControl}
    >
      <span id={labelId} className="tg-label">{label}</span>
      {children}
      <FieldError id={errId} error={showError ? error : null} />
    </motion.div>
  );
}

export function Section({ id, n, title, subtitle, children }) {
  return (
    <motion.section
      id={id}
      className="tg-card"
      aria-labelledby={`${id}-title`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.05 * n }}
    >
      <h2 id={`${id}-title`}>
        <span className="tg-num" aria-hidden="true">{n}</span>
        {title}
      </h2>
      <p className="tg-sub">{subtitle}</p>
      {children}
    </motion.section>
  );
}

/** Lista de itens livres (alergias, comorbidades, medicamentos). Enter adiciona. */
export function ChipField({ label, placeholder, items, onChange, className = "" }) {
  const id = useId();
  const [text, setText] = useState("");

  function add() {
    const v = text.trim();
    if (v && !items.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setText("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !text && items.length) {
      onChange(items.slice(0, -1));
    }
  }

  return (
    <div className={`tg-field ${className}`}>
      <label className="tg-label" htmlFor={id}>{label}</label>
      <ul className="tg-chips" aria-label={`${label}: ${items.length ? items.join(", ") : "nenhum item"}`}>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item}
              className="tg-chip"
              layout
              initial={{ opacity: 0, scale: 0.6, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={SPRING}
            >
              {item}
              <button type="button" aria-label={`Remover ${item}`} onClick={() => onChange(items.filter((i) => i !== item))}>
                <X size={12} />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <input
        id={id}
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        aria-describedby={`${id}-hint`}
      />
      <span id={`${id}-hint`} className="sr-only">Pressione Enter para adicionar.</span>
    </div>
  );
}
