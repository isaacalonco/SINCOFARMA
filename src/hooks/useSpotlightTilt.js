import { useMotionValue, useSpring, useTransform } from "framer-motion";
import { SPRING_TILT } from "../utils/motion";

/**
 * Inclinação 3D com mola + holofote seguindo o mouse (como no card do login).
 * O holofote usa as variáveis CSS --mx/--my no próprio elemento, então
 * fica no fundo do card, por baixo do conteúdo.
 */
export function useSpotlightTilt(max = 5) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING_TILT);
  const sy = useSpring(py, SPRING_TILT);
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);

  function onMouseMove(e) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    px.set(x / rect.width - 0.5);
    py.set(y / rect.height - 0.5);
    el.style.setProperty("--mx", `${x}px`);
    el.style.setProperty("--my", `${y}px`);
  }

  function onMouseLeave(e) {
    px.set(0);
    py.set(0);
    e.currentTarget.style.setProperty("--mx", "-999px");
    e.currentTarget.style.setProperty("--my", "-999px");
  }

  return {
    handlers: { onMouseMove, onMouseLeave },
    style: max ? { rotateX, rotateY, transformPerspective: 900 } : {},
  };
}
