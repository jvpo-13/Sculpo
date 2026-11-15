import type { AdvancedParams } from '../types';
import { erodeRound, labelComponents } from './grid';
import type { Layout } from './layout';
import { BODY, FREE } from './mask';

/** Quantiza v (0..1) em `layers` níveis; 0 ou 1 = contínuo. */
export function quantizeLayers(v: number, layers: number): number {
  if (layers < 2) return v;
  return Math.round(v * (layers - 1)) / (layers - 1);
}

// Amostra bilinear com coordenadas em centros de pixel, borda replicada.
function bilinear(src: Float32Array, w: number, h: number, fx: number, fy: number): number {
  const x = fx < 0 ? 0 : fx > w - 1 ? w - 1 : fx;
  const y = fy < 0 ? 0 : fy > h - 1 ? h - 1 : fy;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 < w - 1 ? x0 + 1 : x0;
  const y1 = y0 < h - 1 ? y0 + 1 : y0;
  const tx = x - x0;
  const ty = y - y0;
  const top = src[y0 * w + x0] * (1 - tx) + src[y0 * w + x1] * tx;
  const bot = src[y1 * w + x0] * (1 - tx) + src[y1 * w + x1] * tx;
  return top * (1 - ty) + bot * ty;
}

type HeightParams = Pick<
  AdvancedParams,
  'layers' | 'reliefType' | 'captureMode' | 'minIslandMm' | 'protectiveBorder'
>;

/**
 * Estágio D, passos 1 a 5: altura normalizada (0..1) por célula.
 * Células de argola/ponte e células livres ficam em 0.
 */
export function computeHeights(
  layout: Layout,
  occ: Uint8Array,
  tonal: Float32Array,
  work: { w: number; h: number },
  p: HeightParams,
): Float32Array {
  const { gx, gy, s } = layout;
  const v = new Float32Array(gx * gy);
  const layers = Math.round(p.layers);
  const engraved = p.reliefType === 'engraved';
  const xEnd = layout.srcX0 + layout.srcW;
  const yEnd = layout.srcY0 + layout.srcH;

  for (let j = 0; j < gy; j++) {
    const py = layout.srcY0 + ((j + 0.5) * s - layout.contentV0) / layout.mmPerPx;
    for (let i = 0; i < gx; i++) {
      const p0 = j * gx + i;
      if (occ[p0] !== BODY) continue;
      const px = layout.srcX0 + ((i + 0.5) * s - layout.contentU0) / layout.mmPerPx;
      // Fora do retângulo do conteúdo (a margem) o tom é 0.
      let val = 0;
      if (px >= layout.srcX0 && px < xEnd && py >= layout.srcY0 && py < yEnd) {
        val = bilinear(tonal, work.w, work.h, px - 0.5, py - 0.5);
      }
      val = quantizeLayers(val, layers);
      v[p0] = engraved ? 1 - val : val;
    }
  }

  // Ilhas de relevo: só faz sentido quando o relevo é em degraus.
  if ((p.captureMode !== 'continuous' || layers >= 2) && p.minIslandMm > 0) {
    const high = new Uint8Array(gx * gy);
    for (let q = 0; q < high.length; q++) high[q] = v[q] > 0.5 ? 1 : 0;
    const { labels, sizes } = labelComponents(high, gx, gy);
    const minCells = (p.minIslandMm * p.minIslandMm) / (s * s);
    for (let q = 0; q < high.length; q++) {
      if (labels[q] !== 0 && sizes[labels[q] - 1] < minCells) v[q] = 0;
    }
  }

  if (p.protectiveBorder) {
    // Anel de 1,2 mm DENTRO do corpo; a dimensão externa não muda.
    const steps = Math.max(1, Math.round(1.2 / s));
    const solid = new Uint8Array(gx * gy);
    for (let q = 0; q < solid.length; q++) solid[q] = occ[q] !== FREE ? 1 : 0;
    const inner = erodeRound(solid, gx, gy, steps);
    for (let q = 0; q < solid.length; q++) {
      if (occ[q] === BODY && inner[q] === 0) v[q] = 1;
    }
  }

  return v;
}

/** Preview de 1 canal: ocupado = 32 + 223*v, livre = 0. */
export function buildPreview(occ: Uint8Array, v: Float32Array): Uint8Array {
  const out = new Uint8Array(occ.length);
  for (let q = 0; q < occ.length; q++) {
    if (occ[q] !== FREE) out[q] = Math.round(32 + 223 * v[q]);
  }
  return out;
}
