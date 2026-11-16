// Campo de distância do chaveiro: f(u, v) em mm, positivo DENTRO do material
// e zero exatamente no contorno. É o que permite posicionar os vértices da
// borda na curva real, em vez de nos cantos das células.
import type { AdvancedParams } from '../types';
import type { Layout } from './layout';

export type Field = (u: number, v: number) => number;

const INF = 1e20;

// Transformada de distância 1D de Felzenszwalb (distância ao quadrado).
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distância euclidiana ao quadrado até o pixel "ligado" mais próximo. */
export function edtSquared(on: Uint8Array, w: number, h: number): Float64Array {
  const out = new Float64Array(w * h);
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = on[y * w + x] ? 0 : INF;
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
}

/**
 * Distância com sinal da figura, em pixels da imagem de trabalho:
 * negativa dentro, positiva fora. Fora da imagem conta como fundo.
 */
export function figureSdf(mask: Uint8Array, w: number, h: number): Float32Array {
  const dOut = edtSquared(mask, w, h);
  // Complemento com 1 px de moldura, para a borda da imagem contar como fundo.
  const pw = w + 2;
  const ph = h + 2;
  const background = new Uint8Array(pw * ph).fill(1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) background[(y + 1) * pw + x + 1] = mask[y * w + x] ? 0 : 1;
  }
  const dIn = edtSquared(background, pw, ph);

  const raw = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      raw[p] = mask[p] ? -(Math.sqrt(dIn[(y + 1) * pw + x + 1]) - 0.5) : Math.sqrt(dOut[p]) - 0.5;
    }
  }

  // Blur 3x3: tira o degrau de 1 px que a máscara binária deixa no campo.
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = y > 0 ? y - 1 : 0;
    const y2 = y < h - 1 ? y + 1 : y;
    for (let x = 0; x < w; x++) {
      const x0 = x > 0 ? x - 1 : 0;
      const x2 = x < w - 1 ? x + 1 : x;
      out[y * w + x] =
        (raw[y0 * w + x0] + raw[y0 * w + x] + raw[y0 * w + x2] +
          raw[y * w + x0] + raw[y * w + x] + raw[y * w + x2] +
          raw[y2 * w + x0] + raw[y2 * w + x] + raw[y2 * w + x2]) / 9;
    }
  }
  return out;
}

/** Amostra bilinear do SDF em coordenadas de pixel; fora da imagem soma a distância extra. */
export function sampleSdf(sdf: Float32Array, w: number, h: number, x: number, y: number): number {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const cx = fx < 0 ? 0 : fx > w - 1 ? w - 1 : fx;
  const cy = fy < 0 ? 0 : fy > h - 1 ? h - 1 : fy;
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = x0 < w - 1 ? x0 + 1 : x0;
  const y1 = y0 < h - 1 ? y0 + 1 : y0;
  const tx = cx - x0;
  const ty = cy - y0;
  const top = sdf[y0 * w + x0] * (1 - tx) + sdf[y0 * w + x1] * tx;
  const bot = sdf[y1 * w + x0] * (1 - tx) + sdf[y1 * w + x1] * tx;
  const ex = fx - cx;
  const ey = fy - cy;
  return top * (1 - ty) + bot * ty + Math.sqrt(ex * ex + ey * ey);
}

/** Campo do corpo (sem argola), conforme o estilo. */
export function bodyField(
  layout: Layout,
  style: AdvancedParams['style'],
  sdf: Float32Array,
  work: { w: number; h: number },
): Field {
  if (style === 'contour') {
    const { srcX0, srcY0, contentU0, contentV0, mmPerPx, marginMm } = layout;
    return (u, v) =>
      marginMm -
      sampleSdf(sdf, work.w, work.h, srcX0 + (u - contentU0) / mmPerPx, srcY0 + (v - contentV0) / mmPerPx) *
        mmPerPx;
  }
  const cu = layout.bodyU0 + layout.bodyW / 2;
  const cv = layout.bodyV0 + layout.bodyH / 2;
  if (style === 'circle') {
    const r = layout.bodyW / 2;
    return (u, v) => r - Math.sqrt((u - cu) * (u - cu) + (v - cv) * (v - cv));
  }
  const hw = layout.bodyW / 2;
  const hh = layout.bodyH / 2;
  return (u, v) => {
    const qx = Math.abs(u - cu) - hw;
    const qy = Math.abs(v - cv) - hh;
    const ox = qx > 0 ? qx : 0;
    const oy = qy > 0 ? qy : 0;
    const inside = Math.min(Math.max(qx, qy), 0);
    return -(Math.sqrt(ox * ox + oy * oy) + inside);
  };
}

export interface Bridge {
  tu: number; // ponto do corpo onde a ponte chega
  tv: number;
  half: number; // meia-largura
}

/** Une corpo, disco da argola e ponte; depois subtrai o furo. */
export function withRing(body: Field, layout: Layout, bridge: Bridge | null): Field {
  const ring = layout.ring;
  if (!ring) return body;
  return (u, v) => {
    const du = u - ring.u;
    const dv = v - ring.v;
    const d = Math.sqrt(du * du + dv * dv);
    let f = Math.max(body(u, v), ring.outerR - d);
    if (bridge) {
      const eu = bridge.tu - ring.u;
      const ev = bridge.tv - ring.v;
      const len2 = eu * eu + ev * ev;
      let t = len2 > 0 ? (du * eu + dv * ev) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qu = du - t * eu;
      const qv = dv - t * ev;
      f = Math.max(f, bridge.half - Math.sqrt(qu * qu + qv * qv));
    }
    return Math.min(f, d - ring.holeR);
  };
}
