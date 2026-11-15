import type { AdvancedParams } from '../types';
import type { WorkImage } from './resample';

type TonalParams = Pick<
  AdvancedParams,
  | 'channel' | 'captureMode' | 'threshold' | 'brightness' | 'contrast'
  | 'gamma' | 'invert' | 'blurPx' | 'morphology'
>;

/** Chave de cache do Estágio B. */
export function tonalKey(p: TonalParams): string {
  return [
    p.channel, p.captureMode, p.threshold, p.brightness, p.contrast,
    p.gamma, p.invert, p.blurPx, p.morphology,
  ].join('|');
}

function pickChannel(work: WorkImage, channel: TonalParams['channel']): Float32Array {
  const n = work.w * work.h;
  const out = new Float32Array(n);
  const { r, g, b, a } = work;
  switch (channel) {
    case 'red': out.set(r); break;
    case 'green': out.set(g); break;
    case 'blue': out.set(b); break;
    case 'alpha': out.set(a); break;
    case 'luma':
      for (let p = 0; p < n; p++) out[p] = 0.2126 * r[p] + 0.7152 * g[p] + 0.0722 * b[p];
      break;
    case 'saturation':
      for (let p = 0; p < n; p++) {
        const mx = Math.max(r[p], g[p], b[p]);
        const mn = Math.min(r[p], g[p], b[p]);
        out[p] = mx <= 0 ? 0 : (255 * (mx - mn)) / mx;
      }
      break;
  }
  return out;
}

// Blur de caixa separável; a borda repete o último pixel.
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const norm = 1 / (2 * radius + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k < 0 ? 0 : x + k >= w ? w - 1 : x + k;
        sum += src[row + xx];
      }
      tmp[row + x] = sum * norm;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k < 0 ? 0 : y + k >= h ? h - 1 : y + k;
        sum += tmp[yy * w + x];
      }
      out[y * w + x] = sum * norm;
    }
  }
  return out;
}

// Um passo de morfologia em tons de cinza com elemento em cruz 3x3.
function morphStep(src: Float32Array, w: number, h: number, dilate: boolean): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let v = src[p];
      if (dilate) {
        if (x > 0 && src[p - 1] > v) v = src[p - 1];
        if (x < w - 1 && src[p + 1] > v) v = src[p + 1];
        if (y > 0 && src[p - w] > v) v = src[p - w];
        if (y < h - 1 && src[p + w] > v) v = src[p + w];
      } else {
        if (x > 0 && src[p - 1] < v) v = src[p - 1];
        if (x < w - 1 && src[p + 1] < v) v = src[p + 1];
        if (y > 0 && src[p - w] < v) v = src[p - w];
        if (y < h - 1 && src[p + w] < v) v = src[p + w];
      }
      out[p] = v;
    }
  }
  return out;
}

// Magnitude de Sobel normalizada pelo máximo da imagem (borda replicada).
function sobel(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  let max = 0;
  for (let y = 0; y < h; y++) {
    const y0 = (y > 0 ? y - 1 : 0) * w;
    const y1 = y * w;
    const y2 = (y < h - 1 ? y + 1 : y) * w;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x2 = x < w - 1 ? x + 1 : x;
      const gx =
        src[y0 + x2] + 2 * src[y1 + x2] + src[y2 + x2] -
        (src[y0 + x0] + 2 * src[y1 + x0] + src[y2 + x0]);
      const gy =
        src[y2 + x0] + 2 * src[y2 + x] + src[y2 + x2] -
        (src[y0 + x0] + 2 * src[y0 + x] + src[y0 + x2]);
      const mag = Math.sqrt(gx * gx + gy * gy);
      out[y1 + x] = mag;
      if (mag > max) max = mag;
    }
  }
  if (max < 1e-6) {
    out.fill(0);
  } else {
    const inv = 1 / max;
    for (let p = 0; p < out.length; p++) out[p] *= inv;
  }
  return out;
}

/** Estágio B (passos 2 a 9). Saída: Float32 0..1 na resolução de trabalho. */
export function computeTonal(work: WorkImage, p: TonalParams): Float32Array {
  const { w, h } = work;
  const n = w * h;
  let v = pickChannel(work, p.channel);

  const blur = Math.round(p.blurPx);
  if (blur > 0) v = boxBlur(v, w, h, blur);

  const bright = p.brightness * 2.55;
  const c = p.contrast * 2.55;
  const f = (259 * (c + 255)) / (255 * (259 - c));
  const invGamma = 1 / p.gamma;
  const useGamma = p.gamma !== 1;
  for (let i = 0; i < n; i++) {
    let x = f * (v[i] + bright - 128) + 128;
    // Clamp antes do gama: valor negativo em pow daria NaN.
    x = x < 0 ? 0 : x > 255 ? 255 : x;
    if (useGamma) x = 255 * Math.pow(x / 255, invGamma);
    v[i] = p.invert ? 255 - x : x;
  }

  const morph = Math.round(p.morphology);
  for (let k = 0; k < Math.abs(morph); k++) v = morphStep(v, w, h, morph > 0);

  for (let i = 0; i < n; i++) v[i] = v[i] < 0 ? 0 : v[i] > 255 ? 255 : v[i];

  switch (p.captureMode) {
    case 'continuous':
      for (let i = 0; i < n; i++) v[i] /= 255;
      return v;
    case 'threshold':
      for (let i = 0; i < n; i++) v[i] = v[i] >= p.threshold ? 1 : 0;
      return v;
    case 'sobel':
      return sobel(v, w, h);
  }
}
