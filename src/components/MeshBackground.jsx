import { useEffect, useRef } from "react";

/*
 * Fundo em malha ("mesh drift"): manchas de cor que derivam devagar e se
 * misturam. Um canvas WebGL1 que preenche o pai, sem dependências.
 * Adaptado do Shader Builder do 21st.dev; o gradiente CSS do pai fica de
 * reserva quando não há WebGL.
 */

const VERT = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

const FRAG = `precision mediump float;

uniform vec3 u_colors[8];
uniform vec4 u_scene;   // resolução.xy, tempo, quantidade de cores
uniform vec4 u_look;    // escala, alcance, contraste, granulado
uniform float u_seed;

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// cada cor é uma mancha gaussiana que passeia numa órbita lenta
vec3 shade(vec2 p, float t) {
  vec3 acc = u_colors[0] * 0.15;
  float total = 0.15;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= u_scene.w) break;
    vec2 c = vec2(
      sin(t * (0.21 + fi * 0.071) + fi * 2.4 + u_seed),
      cos(t * (0.17 + fi * 0.093) + fi * 1.7)) * (0.45 + u_look.y * 0.35);
    float w = exp(-dot(p - c, p - c) * 6.0);
    acc += u_colors[i] * w;
    total += w;
  }
  return acc / total;
}

void main() {
  vec2 res = u_scene.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y) * u_look.x;
  vec3 col = shade(p, u_scene.z);
  col = (col - 0.5) * u_look.z + 0.5;
  col += (grainHash(gl_FragCoord.xy) - 0.5) * u_look.w;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// paleta do login: os mesmos azuis do gradiente e dos brilhos, com um toque do verde-água
const COLORS = ["#00335f", "#004a80", "#1f6fb5", "#3aa0e8", "#0e6f86"];
const LOOK = { scale: 1.16, reach: 0.34, contrast: 1.1, grain: 0.035, speed: 0.55, seed: 1453 };

/**
 * `still`: desenha um quadro só e para (movimento reduzido).
 * Cada montagem cria o próprio <canvas>: um contexto WebGL descartado não volta,
 * e o React pode rodar o efeito de novo no mesmo elemento (StrictMode, troca de
 * `still`). Se o navegador derrubar o contexto, um canvas novo assume sozinho.
 */
export default function MeshBackground({ className = "", still = false }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    let stopCurrent = null;
    let retry = 0;
    let disposed = false;

    const begin = () => {
      stopCurrent = start(wrap, still, () => {
        // contexto perdido: solta este canvas e tenta um novo daqui a pouco
        stopCurrent?.();
        stopCurrent = null;
        if (!disposed) retry = window.setTimeout(begin, 400);
      });
    };
    begin();

    return () => {
      disposed = true;
      window.clearTimeout(retry);
      stopCurrent?.();
    };
  }, [still]);

  return <div ref={wrapRef} className={`mesh-bg ${className}`} aria-hidden="true" />;
}

// Monta um canvas novo dentro de `wrap` e anima. Devolve a função que desmonta;
// `onLost` é chamado se o navegador derrubar o contexto. Sem WebGL, devolve null
// e o gradiente CSS do pai continua aparecendo.
function start(wrap, still, onLost) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  const gl = canvas.getContext("webgl", { antialias: false });
  if (!gl) return null;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const program = gl.createProgram();
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uScene = gl.getUniformLocation(program, "u_scene");
  const colors = COLORS.map(hex);
  while (colors.length < 8) colors.push(colors[colors.length - 1]);
  gl.uniform3fv(gl.getUniformLocation(program, "u_colors"), new Float32Array(colors.flat()));
  gl.uniform4f(gl.getUniformLocation(program, "u_look"), LOOK.scale, LOOK.reach, LOOK.contrast, LOOK.grain);
  gl.uniform1f(gl.getUniformLocation(program, "u_seed"), LOOK.seed);
  wrap.appendChild(canvas);

  let raf = 0;
  let visible = document.visibilityState === "visible";
  let inView = true;
  let disposed = false;
  const t0 = performance.now();

  // fundo desfocado: até ~1 megapixel basta, o resto o navegador estica
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rw = Math.max(1, Math.round(r.width * dpr));
    const rh = Math.max(1, Math.round(r.height * dpr));
    const k = Math.min(1, Math.sqrt(1_000_000 / (rw * rh)));
    const w = Math.max(1, Math.round(rw * k));
    const h = Math.max(1, Math.round(rh * k));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  function render(now) {
    raf = 0;
    if (disposed || gl.isContextLost()) return;
    resize();
    // parado, mostra um instante em que as manchas já estão espalhadas
    const t = still ? 6 : ((now - t0) / 1000) * LOOK.speed;
    gl.uniform4f(uScene, canvas.width, canvas.height, t, COLORS.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!still) request();
  }
  function request() {
    if (!disposed && visible && inView && raf === 0) raf = requestAnimationFrame(render);
  }
  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const ro = new ResizeObserver(() => {
    if (still) render(performance.now());
    else request();
  });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => {
    inView = e?.isIntersecting ?? true;
    if (inView) request();
    else stop();
  });
  io.observe(canvas);
  const onVisibility = () => {
    visible = document.visibilityState === "visible";
    if (visible) request();
    else stop();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onContextLost = (e) => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  request();

  return () => {
    disposed = true;
    stop();
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    if (!gl.isContextLost()) {
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    canvas.remove();
  };
}
