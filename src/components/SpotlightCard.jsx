import { motion } from "framer-motion";
import { useSpotlightTilt } from "../hooks/useSpotlightTilt";
import { EASE } from "../utils/motion";

/** Seção em card com entrada suave e holofote seguindo o mouse (sem inclinação). */
export default function SpotlightCard({ index = 0, className = "", children, ...rest }) {
  const { handlers } = useSpotlightTilt(0);
  return (
    <motion.section
      className={`card spotlight ${className}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.7, ease: EASE }}
      {...handlers}
      {...rest}
    >
      {children}
    </motion.section>
  );
}
