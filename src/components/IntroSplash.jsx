import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import logo from "../assets/logo-sincofarma.webp";
import GlassReveal from "./GlassReveal";
import { MARK_BOX, MARK_CROP, keyedLogo } from "./glassLogo";
import { useMotionPrefs } from "../contexts/motionPrefsContext";
import { appPages } from "../pages/loaders";
import { PAPEIS } from "../services/permissoes";
import { EASE } from "../utils/motion";

const MAX_MS = 8000; // rede ruim: entra assim mesmo, cada página mostra o próprio carregamento
const HANDOFF_MS = 1300; // da marca assentada até o logotipo inteiro e a saudação no lugar

const STEPS = ["Preparando seu painel", "Carregando os módulos", "Buscando os dados da farmácia", "Tudo pronto"];

// mesma cor de fundo de .intro, porque o canvas pinta o próprio fundo
const INTRO_BG = "#f4f8fc";
// o canvas do vidro mede GLASS_K × a largura do logotipo; o azulejo é 1/1,75 do canvas
const GLASS_K = 1.2;
// Linha do tempo do vidro: gota rápida, marca grande contra a borda, solta aos 1,2 s
// e para aos 2,3 s. finalScale faz a marca parar exatamente do tamanho que ela tem
// no logotipo: largura = 0,7 × 0,957 (assentamento) × finalScale × azulejo.
const GLASS = { present: 1.2, glide: 1.2, startZoom: 2.2, response: 0.4, tileSize: 9999, logoScale: 0.7, finalScale: 0.48 };
// deslocamento que põe a marca no centro da tela enquanto está no vidro
const MARK_SHIFT = `${(0.5 - MARK_BOX.cx) * 100}%`;
// recorte que mostra só a marca no logotipo, antes do "Sincofarma" se desenhar
const MARK_ONLY = `inset(0% 0% 0% ${(MARK_CROP[0] * 100).toFixed(2)}%)`;

/**
 * Tela de entrada logo depois do login. A marca do Sincofarma nasce numa gota de
 * vidro no centro, o vidro solta e ela pousa no tamanho exato que tem no logotipo;
 * então o "Sincofarma" se desenha a partir dela e a saudação aparece. Enquanto
 * isso as páginas do painel baixam e os dados chegam (`ready`). Chama `onDone` ao terminar.
 */
export default function IntroSplash({ user, ready, onDone }) {
  const { reduced } = useMotionPrefs();
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  // settled: a marca parou no vidro; shown: logotipo e saudação já no lugar
  const [settled, setSettled] = useState(reduced);
  const [shown, setShown] = useState(reduced);
  const onSettle = useCallback(() => setSettled(true), []);
  // logotipo sem o contorno branco (pronto bem antes de aparecer; até lá, o original)
  const [logoSrc, setLogoSrc] = useState(logo);
  useEffect(() => {
    keyedLogo().then(setLogoSrc, () => {});
  }, []);

  useEffect(() => {
    // falha de rede num chunk não segura a entrada: a rota tenta de novo depois
    appPages.forEach((load) => load().catch(() => {}).finally(() => setPagesLoaded((n) => n + 1)));
    const max = setTimeout(() => setTimedOut(true), MAX_MS);
    return () => clearTimeout(max);
  }, []);

  useEffect(() => {
    if (!settled || shown) return undefined;
    const t = setTimeout(() => setShown(true), HANDOFF_MS);
    return () => clearTimeout(t);
  }, [settled, shown]);

  const pagesDone = pagesLoaded >= appPages.length;
  const allLoaded = pagesDone && ready;
  // com movimento reduzido ainda segura um instante, para a tela não só piscar
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    if (!reduced) return undefined;
    const t = setTimeout(() => setMinElapsed(true), 1200);
    return () => clearTimeout(t);
  }, [reduced]);
  const finished = (allLoaded && (reduced ? minElapsed : shown)) || timedOut;

  useEffect(() => {
    if (!finished) return undefined;
    // deixa a barra chegar ao fim antes de sair
    const t = setTimeout(onDone, 450);
    return () => clearTimeout(t);
  }, [finished, onDone]);

  const progress = finished ? 1 : 0.15 + 0.45 * (pagesLoaded / appPages.length) + (ready ? 0.3 : 0);
  const step = finished ? 3 : !pagesDone ? 1 : !ready ? 2 : 3;
  // "Dra. Ana Souza" -> "Dra. Ana"; "Isaac (teste)" -> "Isaac"
  const words = (user?.name ?? "").replace(/\s*\(.*?\)/g, "").trim().split(/\s+/);
  const firstName = /^dra?\.$/i.test(words[0]) ? words.slice(0, 2).join(" ") : words[0];
  const roles = (user?.roles ?? []).map((r) => PAPEIS[r]).filter(Boolean).join(" + ");
  // a saudação entra junto com o "Sincofarma"
  const greet = settled ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 };

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
        {/* caixa do logotipo: começa deslocada para a marca ficar no centro da tela */}
        <motion.div
          className="intro-mark"
          style={{ "--glass-k": GLASS_K, "--mark-x": `${MARK_BOX.cx * 100}%`, "--mark-y": `${MARK_BOX.cy * 100}%` }}
          initial={false}
          animate={{ x: settled ? "0%" : MARK_SHIFT }}
          transition={{ delay: 0.3, duration: 0.9, ease: EASE }}
        >
          {!reduced && (
            <motion.div
              className="intro-glass-wrap"
              initial={false}
              animate={{ opacity: settled ? 0 : 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <GlassReveal
                logo={logo}
                crop={MARK_CROP}
                background={INTRO_BG}
                label="Sincofarma DF"
                tuning={GLASS}
                onSettle={onSettle}
                className="intro-glass"
              />
            </motion.div>
          )}
          {/* o logotipo: primeiro só a marca, no mesmo ponto do vidro; depois o "Sincofarma" se desenha */}
          <motion.img
            src={logoSrc}
            alt="Sincofarma DF"
            className="intro-logo"
            initial={false}
            animate={
              settled
                ? { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }
                : { opacity: 0, clipPath: MARK_ONLY }
            }
            transition={{
              opacity: { duration: 0.35, ease: "easeOut" },
              clipPath: { delay: 0.3, duration: 0.9, ease: EASE },
            }}
          />
        </motion.div>

        <motion.p
          className="intro-hello"
          initial={false}
          animate={greet}
          transition={{ delay: 0.7, duration: 0.5, ease: EASE }}
        >
          {firstName ? `Olá, ${firstName}` : "Bem-vindo(a)"}
        </motion.p>
        {roles && (
          <motion.p
            className="intro-role"
            initial={false}
            animate={greet}
            transition={{ delay: 0.85, duration: 0.5, ease: EASE }}
          >
            Entrando como <b>{roles}</b>
          </motion.p>
        )}

        <motion.div
          className="intro-load"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="intro-progress">
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progress }}
              transition={{ duration: 0.5, ease: EASE }}
            />
          </div>
          <p className="intro-step">
            {STEPS[step]}
            {step < 3 && "…"}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
