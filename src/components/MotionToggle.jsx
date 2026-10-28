import { Sparkles, Zap, Leaf } from "lucide-react";
import { useMotionPrefs } from "../contexts/motionPrefsContext";

const LABEL = {
  auto: "Animações: automático (segue o sistema)",
  full: "Animações: sempre ligadas",
  reduced: "Animações: reduzidas",
};
const ICON = { auto: Sparkles, full: Zap, reduced: Leaf };

/** Botão que alterna automático → ligadas → reduzidas. */
export default function MotionToggle({ className = "" }) {
  const { mode, reduced, cycle } = useMotionPrefs();
  const Icon = ICON[mode];
  return (
    <button
      type="button"
      className={`motion-toggle${reduced ? " is-reduced" : ""} ${className}`}
      onClick={cycle}
      aria-label={LABEL[mode]}
      title={LABEL[mode]}
      aria-pressed={mode !== "auto"}
    >
      <Icon size={16} />
      <span className="motion-toggle-text">
        {mode === "auto" ? "Auto" : mode === "full" ? "Ligadas" : "Reduzidas"}
      </span>
    </button>
  );
}
