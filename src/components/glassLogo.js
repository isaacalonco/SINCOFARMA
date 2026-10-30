import logo from "../assets/logo-sincofarma.webp";

/*
 * Prepara um logo para a revelação em vidro (components/GlassReveal.jsx):
 * desenha a imagem numa textura e monta o campo de distância que o shader lê.
 * Separado do componente para o Login pré-calcular a marca antes da intro.
 */

export const TEX = 1024; // tamanho da textura do logo
export const BOX = 0.75; // parte da textura que o logo ocupa (o resto é folga para o SDF)

// a marca (traço azul e dourado sobre o "DF") dentro do logo, em frações da imagem:
// começa no vão entre o "a" de "Sincofarma" e o "D" (medido em 0,7517)
export const MARK_CROP = [0.7517, 0, 0.2483, 0.8];
// caixa visível da marca no logo, sem o contorno branco: centro e largura em frações
// (a largura manda, a marca é mais larga que alta). A intro alinha o vidro com ela.
export const MARK_BOX = { cx: 0.8684, cy: 0.3979, size: 0.2217 };

/** Começa a preparar a marca do Sincofarma e o logotipo sem contorno; ficam em cache. */
export function warmMark() {
  loadLogo(logo, MARK_CROP).catch(() => {});
  keyedLogo().catch(() => {});
}

let keyedJob = null;
/**
 * O logotipo inteiro sem o contorno branco, como data URL (a CSP só libera
 * imagens do próprio site e `data:`). Fica igual ao que o vidro desenha.
 */
export function keyedLogo() {
  if (!keyedJob) {
    keyedJob = loadImage(logo).then((img) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const im = g.getImageData(0, 0, c.width, c.height);
      keyWhite(im.data);
      g.putImageData(im, 0, 0);
      return c.toDataURL("image/png");
    });
    keyedJob.catch(() => (keyedJob = null));
  }
  return keyedJob;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("GlassReveal: o logo não carregou"));
    img.src = src;
  });
}

// O logo tem um contorno branco opaco em volta das letras (feito para fundo branco).
// Para o vidro só interessa o desenho colorido: o menor canal decide. Até 125 é cor
// cheia (azul e dourado ficam abaixo de 60); de 215 para cima é o contorno, com o
// ruído de compressão do WebP, e some por inteiro; no meio, a borda suavizada.
function keyWhite(d) {
  for (let i = 0; i < d.length; i += 4) {
    const k = (215 - Math.min(d[i], d[i + 1], d[i + 2])) / 90;
    d[i + 3] = Math.round(d[i + 3] * (k < 0 ? 0 : k > 1 ? 1 : k));
  }
}

// Desenha a origem (ou um recorte dela, em frações) num canvas TEX×TEX, sem o
// contorno branco, cortada nos pixels visíveis e encaixada na caixa do logo.
function fitToTexture(img, crop) {
  const [cx, cy, cw, ch] = crop ?? [0, 0, 1, 1];
  const sx = cx * img.naturalWidth, sy = cy * img.naturalHeight;
  const sw = cw * img.naturalWidth, sh = ch * img.naturalHeight;
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = TEX;
  const tc = tmp.getContext("2d", { willReadFrequently: true });
  const s0 = Math.min(TEX / sw, TEX / sh);
  const dx0 = (TEX - sw * s0) / 2;
  const dy0 = (TEX - sh * s0) / 2;
  tc.drawImage(img, sx, sy, sw, sh, dx0, dy0, sw * s0, sh * s0);
  const d = tc.getImageData(0, 0, TEX, TEX).data;
  keyWhite(d);

  let x0 = TEX, y0 = TEX, x1 = -1, y1 = -1;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      if (d[(y * TEX + x) * 4 + 3] > 64) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("GlassReveal: o logo está vazio");
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const s = (TEX * BOX) / Math.max(bw, bh);

  const out = document.createElement("canvas");
  out.width = out.height = TEX;
  const oc = out.getContext("2d", { willReadFrequently: true });
  oc.imageSmoothingQuality = "high";
  oc.drawImage(img, sx, sy, sw, sh, TEX / 2 - (x0 + bw / 2 - dx0) * s, TEX / 2 - (y0 + bh / 2 - dy0) * s, sw * s0 * s, sh * s0 * s);
  const im = oc.getImageData(0, 0, TEX, TEX);
  keyWhite(im.data);
  oc.putImageData(im, 0, 0);
  return out;
}

// Campo de distância com sinal a partir do alfa (método TinySDF): + fora, − dentro.
function buildSdf(canvas) {
  const n = TEX * TEX;
  const alpha = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, TEX, TEX).data;
  const INF = 1e20;
  const outer = new Float64Array(n);
  const inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = alpha[i * 4 + 3] / 255;
    if (a >= 1) { outer[i] = 0; inner[i] = INF; }
    else if (a <= 0) { outer[i] = INF; inner[i] = 0; }
    else {
      const dd = 0.5 - a;
      outer[i] = dd > 0 ? dd * dd : 0;
      inner[i] = dd < 0 ? dd * dd : 0;
    }
  }
  const f = new Float64Array(TEX);
  const z = new Float64Array(TEX + 1);
  const v = new Uint16Array(TEX);
  edt(outer, f, v, z, INF);
  edt(inner, f, v, z, INF);
  const sdf = new Float32Array(n);
  for (let i = 0; i < n; i++) sdf[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / TEX;
  return sdf;
}

function edt(grid, f, v, z, INF) {
  for (let x = 0; x < TEX; x++) edt1d(grid, x, TEX, f, v, z, INF);
  for (let y = 0; y < TEX; y++) edt1d(grid, y * TEX, 1, f, v, z, INF);
}

function edt1d(grid, offset, stride, f, v, z, INF) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < TEX; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < TEX; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const qr = q - r;
    grid[offset + q * stride] = f[r] + qr * qr;
  }
}

// Um SDF por logo+recorte para a página inteira (~100 ms para montar).
const logoCache = new Map();

export function loadLogo(logo, crop) {
  const key = logo + "|" + (crop ?? []).join(",");
  let job = logoCache.get(key);
  if (!job) {
    job = loadImage(logo).then((img) => {
      const canvas = fitToTexture(img, crop);
      return { canvas, sdf: buildSdf(canvas) };
    });
    logoCache.set(key, job);
    job.catch(() => logoCache.delete(key));
  }
  return job;
}
