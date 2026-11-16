// Estágio B.1: reamostragem por média de área para a resolução de trabalho.
// Feita uma vez por imagem (não depende de nenhum parâmetro).

export const WORK_R = 512;

export interface Rgba {
  data: Uint8ClampedArray | Uint8Array; // RGBA, alpha não pré-multiplicado
  width: number;
  height: number;
}

/** Imagem de trabalho: RGB já compostos sobre branco (0..255) e alpha (0..255). */
export interface WorkImage {
  w: number;
  h: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  a: Float32Array;
}

export function workSize(width: number, height: number, R = WORK_R): { w: number; h: number } {
  const big = Math.max(width, height);
  return {
    w: Math.max(1, Math.round((width * R) / big)),
    h: Math.max(1, Math.round((height * R) / big)),
  };
}

interface AxisWeights {
  start: Int32Array;
  count: Int32Array;
  weights: Float64Array; // dstN * maxCount
  maxCount: number;
}

// B-spline cúbica: sem oscilação, e o contorno de nível fica liso (C2).
function bspline(t: number): number {
  const a = Math.abs(t);
  if (a < 1) return (4 - 6 * a * a + 3 * a * a * a) / 6;
  if (a < 2) return ((2 - a) * (2 - a) * (2 - a)) / 6;
  return 0;
}

// Ampliação suave: 4 vizinhos com pesos de B-spline (borda replicada).
// Evita que cada pixel de uma imagem pequena vire um bloco quadrado.
function splineWeights(srcN: number, dstN: number): AxisWeights {
  const scale = srcN / dstN;
  const maxCount = 4;
  const start = new Int32Array(dstN);
  const count = new Int32Array(dstN);
  const weights = new Float64Array(dstN * maxCount);
  for (let i = 0; i < dstN; i++) {
    const c = (i + 0.5) * scale - 0.5; // centro em coordenadas da origem
    const f = Math.floor(c);
    const s0 = Math.max(0, f - 1);
    const s1 = Math.min(srcN - 1, f + 2);
    for (let tap = f - 1; tap <= f + 2; tap++) {
      const idx = tap < 0 ? 0 : tap > srcN - 1 ? srcN - 1 : tap;
      weights[i * maxCount + (idx - s0)] += bspline(c - tap);
    }
    start[i] = s0;
    count[i] = s1 - s0 + 1;
  }
  return { start, count, weights, maxCount };
}

// Para cada pixel de destino, os pixels de origem cobertos e a fração de cada um.
function axisWeights(srcN: number, dstN: number, smoothUpscale: boolean): AxisWeights {
  if (smoothUpscale && dstN > srcN) return splineWeights(srcN, dstN);
  const scale = srcN / dstN;
  const maxCount = Math.ceil(scale) + 1;
  const start = new Int32Array(dstN);
  const count = new Int32Array(dstN);
  const weights = new Float64Array(dstN * maxCount);
  for (let i = 0; i < dstN; i++) {
    const a = i * scale;
    const b = (i + 1) * scale;
    const s0 = Math.min(srcN - 1, Math.floor(a));
    const s1 = Math.max(s0 + 1, Math.min(srcN, Math.ceil(b)));
    let total = 0;
    for (let s = s0; s < s1; s++) {
      const wgt = Math.max(0, Math.min(b, s + 1) - Math.max(a, s));
      weights[i * maxCount + (s - s0)] = wgt;
      total += wgt;
    }
    // total só é 0 por erro de arredondamento; nesse caso usa o pixel inteiro.
    if (total <= 0) {
      weights[i * maxCount] = 1;
      total = 1;
    }
    for (let k = 0; k < s1 - s0; k++) weights[i * maxCount + k] /= total;
    start[i] = s0;
    count[i] = s1 - s0;
  }
  return { start, count, weights, maxCount };
}

/**
 * Média de área separável ao reduzir. Ao ampliar (imagem menor que R):
 * interpolação suave se `smoothUpscale`, senão blocos (estilo pixelado).
 */
export function resampleToWork(src: Rgba, R = WORK_R, smoothUpscale = false): WorkImage {
  const { width: sw, height: sh, data } = src;
  const { w, h } = workSize(sw, sh, R);
  const wx = axisWeights(sw, w, smoothUpscale);
  const wy = axisWeights(sh, h, smoothUpscale);

  // Passo horizontal: sh linhas x w colunas. A composição sobre branco é
  // linear, então pode ser feita antes da média.
  const tr = new Float32Array(w * sh);
  const tg = new Float32Array(w * sh);
  const tb = new Float32Array(w * sh);
  const ta = new Float32Array(w * sh);
  for (let y = 0; y < sh; y++) {
    const row = y * sw * 4;
    for (let x = 0; x < w; x++) {
      const s0 = wx.start[x];
      const cnt = wx.count[x];
      const wo = x * wx.maxCount;
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < cnt; k++) {
        const q = row + (s0 + k) * 4;
        const wgt = wx.weights[wo + k];
        const al = data[q + 3] / 255;
        const white = 255 * (1 - al);
        r += wgt * (data[q] * al + white);
        g += wgt * (data[q + 1] * al + white);
        b += wgt * (data[q + 2] * al + white);
        a += wgt * data[q + 3];
      }
      const p = y * w + x;
      tr[p] = r; tg[p] = g; tb[p] = b; ta[p] = a;
    }
  }

  const out: WorkImage = {
    w,
    h,
    r: new Float32Array(w * h),
    g: new Float32Array(w * h),
    b: new Float32Array(w * h),
    a: new Float32Array(w * h),
  };
  for (let y = 0; y < h; y++) {
    const s0 = wy.start[y];
    const cnt = wy.count[y];
    const wo = y * wy.maxCount;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < cnt; k++) {
        const q = (s0 + k) * w + x;
        const wgt = wy.weights[wo + k];
        r += wgt * tr[q]; g += wgt * tg[q]; b += wgt * tb[q]; a += wgt * ta[q];
      }
      const p = y * w + x;
      out.r[p] = r; out.g[p] = g; out.b[p] = b; out.a[p] = a;
    }
  }
  return out;
}
