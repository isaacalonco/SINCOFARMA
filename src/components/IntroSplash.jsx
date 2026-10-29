import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import logo from "../assets/logo-sincofarma.webp";
import GlassReveal from "./GlassReveal";
import { MARK_CROP } from "./glassLogo";
import { useMotionPrefs } from "../contexts/motionPrefsContext";
import { appPages } from "../pages/loaders";
import { PAPEIS } from "../services/permissoes";
import { EASE } from "../utils/motion";

const MIN_MS = 2600; // tempo da marca sair do vidro; abaixo disso a tela só pisca
const MAX_MS = 8000; // rede ruim: entra assim mesmo, cada página mostra o próprio carregamento

const STEPS = ["Preparando seu painel", "Carregando os módulos", "Buscando os dados da farmácia", "Tudo pronto"];

// mesma cor de fundo de .intro, porque o canvas pinta o próprio fundo
const INTRO_BG = "#f4f8fc";
// gota rápida, marca grande contra a borda do vidro, solta cedo
const GLASS = { present: 1.5, glide: 1.4, startZoom: 2.2, response: 0.4, tileSize: 220 };

/**
 * Tela de entrada logo depois do login: a marca do Sincofarma sai de uma gota de
 * vidro enquanto as páginas do painel baixam e os dados chegam (`ready`).
 * Chama `onDone` ao terminar.
 */
export default function IntroSplash({ user, ready, onDone }) {
  const { reduced } = useMotionPrefs();
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  // com movimento reduzido o logotipo já entra inteiro
  const [released, setReleased] = useState(reduced);
  const onRelease = useCallback(() => setReleased(true), []);

  useEffect(() => {
    // falha de rede num chunk não segura a entrada: a rota tenta de novo depois
    appPages.forEach((load) => load().catch(() => {}).finally(() => setPagesLoaded((n) => n + 1)));
    const min = setTimeout(() => setMinElapsed(true), reduced ? 1200 : MIN_MS);
    const max = setTimeout(() => setTimedOut(true), MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [reduced]);

  const pagesDone = pagesLoaded >= appPages.length;
  const allLoaded = pagesDone && ready;
  const finished = (allLoaded && minElapsed) || timedOut;

  useEffect(() => {
    if (!finished) return undefined;
    // deixa a barra chegar ao fim antes de sair
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [finished, onDone]);

  const progress = finished ? 1 : 0.15 + 0.45 * (pagesLoaded / appPages.length) + (ready ? 0.3 : 0);
  const step = finished ? 3 : !pagesDone ? 1 : !ready ? 2 : 3;
  // "Dra. Ana Souza" -> "Dra. Ana"; "Isaac (teste)" -> "Isaac"
  const words = (user?.name ?? "").replace(/\s*\(.*?\)/g, "").trim().split(/\s+/);
  const firstName = /^dra?\.$/i.test(words[0]) ? words.slice(0, 2).join(" ") : words[0];
  const roles = (user?.roles ?? []).map((r) => PAPEIS[r]).filter(Boolean).join(" + ");

  return (
    <motion.div
      className="intro"
      role="status"
      aria-live="polite"
      aria-label={`Carregando o painel. ${STEPS[step]}.`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.45, ease: EASE } }}
    >
      <div className="intro-bg" aria-hidden="true">
        <motion.i
          className="intro-glow intro-glow--a"
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.i
          className="intro-glow intro-glow--b"
          animate={{ opacity: [0.4, 0.75, 0.4], scale: [1.05, 1, 1.05] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="intro-card">
        <div className={`intro-mark${released ? " is-released" : ""}`}>
          <GlassReveal
            logo={logo}
            crop={MARK_CROP}
            background={INTRO_BG}
            label="Sincofarma DF"
            still={reduced}
            tuning={GLASS}
            onRelease={onRelease}
            className="intro-glass"
          />
          {/* o logotipo inteiro entra embaixo quando o vidro solta a marca */}
          <motion.img
            src={logo}
            alt=""
            className="intro-logo"
            initial={false}
            animate={released ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.7, ease: EASE }}
          />
        </div>

        <motion.p
          className="intro-hello"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
        >
          {firstName ? `Olá, ${firstName}` : "Bem-vindo(a)"}
        </motion.p>
        {roles && (
          <motion.p
            className="intro-role"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Entrando como <b>{roles}</b>
          </motion.p>
        )}

        <div className="intro-progress" aria-hidden="true">
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        </div>
        <p className="intro-step" aria-hidden="true">
          {STEPS[step]}
          {step < 3 && "…"}
        </p>
      </div>
    </motion.div>
  );
}
