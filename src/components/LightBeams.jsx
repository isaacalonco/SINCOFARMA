import { motion } from "framer-motion";
import { pulse } from "../utils/motion";
import "./LightBeams.css";

/** Feixes de luz percorrendo a borda de um card (usado no login e no dashboard). */
export default function LightBeams({ className = "" }) {
  const beam = (axis, delay) => ({
    animate: {
      [axis]: ["-50%", "100%"],
      opacity: [0.35, 1, 0.35],
      filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"],
    },
    transition: {
      [axis]: { duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay },
      opacity: { duration: 1.2, repeat: Infinity, repeatType: "mirror", delay },
      filter: { duration: 1.5, repeat: Infinity, repeatType: "mirror", delay },
    },
  });

  return (
    <div className={`beams ${className}`} aria-hidden="true">
      <motion.span className="beam beam--top" {...beam("left", 0)} />
      <motion.span className="beam beam--right" {...beam("top", 0.6)} />
      <motion.span className="beam beam--bottom" {...beam("right", 1.2)} />
      <motion.span className="beam beam--left" {...beam("bottom", 1.8)} />
      <motion.span className="corner corner--tl" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={pulse(2)} />
      <motion.span className="corner corner--tr" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={pulse(2.4, 0.5)} />
      <motion.span className="corner corner--br" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={pulse(2.2, 1)} />
      <motion.span className="corner corner--bl" animate={{ opacity: [0.3, 0.8, 0.3] }} transition={pulse(2.3, 1.5)} />
    </div>
  );
}
