import logo from "../assets/logo-sincofarma.webp";

/*
 * Prepara um logo para a revelação em vidro (components/GlassReveal.jsx):
 * desenha a imagem numa textura e monta o campo de distância que o shader lê.
 * Separado do componente para o Login pré-calcular a marca antes da intro.
 */

export const TEX = 1024; // tamanho da textura do logo
export const BOX = 0.75; // parte da textura que o logo ocupa (o resto é folga para o SDF)

// a marca (traço azul e dourado sobre o "DF") dentro do logo, em frações da imagem
export const MARK_CROP = [0.74, 0.03, 0.25, 0.76];

/** Começa a preparar a marca do Sincofarma; o resultado fica em cache. */
export function warmMark() {
  loadLogo(logo, MARK_CROP).catch(() => {});
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

// Desenha a origem (ou um recorte dela, em frações) num canvas TEX×TEX, cortada
// nos pixels visíveis e encaixada na caixa do logo.
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

  let x0 = TEX, y0 = TEX, x1 = -1, y1 = -1;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      if (d[(y * TEX + x) * 4 + 3] > 8) {
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
