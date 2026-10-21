// Linguagem de movimento compartilhada entre Login e Dashboard.

export const EASE = [0.22, 1, 0.36, 1];

export const SPRING = { type: "spring", stiffness: 400, damping: 25 };
export const SPRING_SOFT = { type: "spring", stiffness: 260, damping: 22 };
export const SPRING_TILT = { stiffness: 150, damping: 18, mass: 0.4 };

/** Entrada escalonada: sobe e aparece. `base` é o atraso inicial. */
export const rise = (i = 0, base = 0.08) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: base + i * 0.07, duration: 0.6, ease: EASE },
});

/** Pulso contínuo e suave (brilhos, ícones). */
export const pulse = (duration, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  repeatType: "mirror",
  ease: "easeInOut",
});

/** Hover/tap de botões, igual ao login. */
export const press = {
  whileHover: { scale: 1.02, y: -1 },
  whileTap: { scale: 0.97 },
  transition: SPRING,
};
