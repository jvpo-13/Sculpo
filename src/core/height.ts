import type { AdvancedParams } from '../types';
import type { Field } from './field';
import { erodeRound, labelComponents } from './grid';
import type { Layout } from './layout';
import { BODY, FREE } from './mask';

const BORDER_MM = 1.2;

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

// Imagem integral: permite a média exata de qualquer retângulo em O(1).
function integralImage(src: Float32Array, w: number, h: number, layers: number): Float64Array {
  const iw = w + 1;
  const out = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      // As camadas são quantizadas por pixel, ANTES da média: assim o degrau
      // entre níveis também sai com antialiasing.
      row += quantizeLayers(src[y * w + x], layers);
      out[(y + 1) * iw + x + 1] = out[y * iw + x + 1] + row;
    }
  }
  return out;
}

// Integral de (0,0) até (x,y), com x e y fracionários.
function integralAt(I: Float64Array, w: number, h: number, x: number, y: number): number {
  const iw = w + 1;
  const x0 = Math.min(w - 1, Math.floor(x));
  const y0 = Math.min(h - 1, Math.floor(y));
  const tx = x - x0;
  const ty = y - y0;
  const a = I[y0 * iw + x0];
  const b = I[y0 * iw + x0 + 1];
  const c = I[(y0 + 1) * iw + x0];
  const d = I[(y0 + 1) * iw + x0 + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

type HeightParams = Pick<
  AdvancedParams,
  'layers' | 'reliefType' | 'captureMode' | 'minIslandMm' | 'protectiveBorder'
>;

/**
 * Estágio D, passos 1 a 5: altura normalizada (0..1) por célula.
 * Células de argola/ponte e células livres ficam em 0.
 *
 * Com `field` (acabamento suave) a altura é a MÉDIA do tom na área da célula
 * (antialiasing), e a borda protetora usa a distância real ao contorno.
 * Sem `field` é o comportamento pixelado: um ponto por célula.
 */
export function computeHeights(
  layout: Layout,
  occ: Uint8Array,
  tonal: Float32Array,
  work: { w: number; h: number },
  p: HeightParams,
  field: Field | null = null,
): Float32Array {
  const { gx, gy, s } = layout;
  const v = new Float32Array(gx * gy);
  const layers = Math.round(p.layers);
  const engraved = p.reliefType === 'engraved';
  const smooth = field !== null;
  const xEnd = layout.srcX0 + layout.srcW;
  const yEnd = layout.srcY0 + layout.srcH;

  const integral = smooth ? integralImage(tonal, work.w, work.h, layers) : null;
  // Meio lado da célula em pixels; mínimo de meio pixel (equivale ao bilinear).
  const half = Math.max(0.5, (0.5 * s) / layout.mmPerPx);
  const boxArea = 4 * half * half;

  for (let j = 0; j < gy; j++) {
    const py = layout.srcY0 + ((j + 0.5) * s - layout.contentV0) / layout.mmPerPx;
    for (let i = 0; i < gx; i++) {
      const p0 = j * gx + i;
      if (occ[p0] !== BODY) continue;
      const px = layout.srcX0 + ((i + 0.5) * s - layout.contentU0) / layout.mmPerPx;
      let val = 0;
      if (integral) {
        // Recorta a caixa no retângulo do conteúdo; o que fica fora vale 0.
        const x0 = Math.max(layout.srcX0, px - half);
        const x1 = Math.min(xEnd, px + half);
        const y0 = Math.max(layout.srcY0, py - half);
        const y1 = Math.min(yEnd, py + half);
        if (x1 > x0 && y1 > y0) {
          const total =
            integralAt(integral, work.w, work.h, x1, y1) - integralAt(integral, work.w, work.h, x0, y1) -
            integralAt(integral, work.w, work.h, x1, y0) + integralAt(integral, work.w, work.h, x0, y0);
          val = total / boxArea;
          val = val < 0 ? 0 : val > 1 ? 1 : val;
        }
      } else {
        // Fora do retângulo do conteúdo (a margem) o tom é 0.
        if (px >= layout.srcX0 && px < xEnd && py >= layout.srcY0 && py < yEnd) {
          val = bilinear(tonal, work.w, work.h, px - 0.5, py - 0.5);
        }
        val = quantizeLayers(val, layers);
      }
      v[p0] = engraved ? 1 - val : val;
    }
  }

  // Ilhas de relevo: só faz sentido quando o relevo é em degraus.
  if ((p.captureMode !== 'continuous' || layers >= 2) && p.minIslandMm > 0) {
    const n = gx * gy;
    const high = new Uint8Array(n);
    for (let q = 0; q < n; q++) high[q] = v[q] > 0.5 ? 1 : 0;
    const { labels, sizes } = labelComponents(high, gx, gy);
    const minCells = (p.minIslandMm * p.minIslandMm) / (s * s);
    const removed = new Uint8Array(n);
    let any = false;
    for (let q = 0; q < n; q++) {
      if (labels[q] !== 0 && sizes[labels[q] - 1] < minCells) {
        removed[q] = 1;
        any = true;
      }
    }
    if (any) {
      for (let q = 0; q < n; q++) {
        if (removed[q]) {
          v[q] = 0;
          continue;
        }
        if (!smooth || high[q] || v[q] === 0) continue;
        // Suave: a franja de antialiasing em volta da ilha removida também sai.
        const x = q % gx;
        const y = (q - x) / gx;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1 && !near; dx++) {
            const xx = x + dx, yy = y + dy;
            near = xx >= 0 && yy >= 0 && xx < gx && yy < gy && removed[yy * gx + xx] === 1;
          }
        }
        if (near) v[q] = 0;
      }
    }
  }

  if (p.protectiveBorder) {
    if (field) {
      // Anel de 1,2 mm medido pela distância real ao contorno, com a borda
      // interna suavizada em 1 célula. Células que o campo considera fora
      // (buracos preenchidos, correção de pinças) não recebem borda.
      for (let j = 0; j < gy; j++) {
        for (let i = 0; i < gx; i++) {
          const q = j * gx + i;
          if (occ[q] !== BODY) continue;
          const f = field((i + 0.5) * s, (j + 0.5) * s);
          if (f < -s) continue;
          const cover = (BORDER_MM - f) / s + 0.5;
          const c = cover < 0 ? 0 : cover > 1 ? 1 : cover;
          if (c > v[q]) v[q] = c;
        }
      }
    } else {
      // Pixelado: anel de max(1, round(1,2/s)) células dentro do corpo.
      const steps = Math.max(1, Math.round(BORDER_MM / s));
      const solid = new Uint8Array(gx * gy);
      for (let q = 0; q < solid.length; q++) solid[q] = occ[q] !== FREE ? 1 : 0;
      const inner = erodeRound(solid, gx, gy, steps);
      for (let q = 0; q < solid.length; q++) {
        if (occ[q] === BODY && inner[q] === 0) v[q] = 1;
      }
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
