import type { AdvancedParams, Warning } from '../types';
import { bodyField, withRing, type Bridge, type Field } from './field';
import type { Figure } from './figure';
import { dilateRound, fillHoles, labelComponents } from './grid';
import type { Layout } from './layout';

// Tipos de célula na grade de ocupação.
export const FREE = 0;
export const BODY = 1;
export const RING = 2; // argola ou ponte: altura de relevo sempre 0

/** Não sobrou corpo para gerar malha (erro 'blank'). */
export class BlankError extends Error {
  constructor() {
    super('Não detectamos um desenho nesta imagem.');
    this.name = 'BlankError';
  }
}

export interface MaskResult {
  occ: Uint8Array; // gx*gy, FREE | BODY | RING
  warnings: Warning[];
  // Campo de distância do contorno (só no acabamento suave).
  field: Field | null;
}

/**
 * Corrige "pinças" (2x2 com só duas células diagonais ocupadas) preenchendo
 * as duas livres. É o que garante malha 2-manifold. Devolve o nº de passadas.
 */
export function fixPinches(occ: Uint8Array, gx: number, gy: number, maxPasses = 16): number {
  for (let pass = 1; pass <= maxPasses; pass++) {
    let changed = false;
    for (let j = 0; j < gy - 1; j++) {
      for (let i = 0; i < gx - 1; i++) {
        const a = j * gx + i;      // a b
        const b = a + 1;           // c d
        const c = a + gx;
        const d = c + 1;
        if (occ[a] && occ[d] && !occ[b] && !occ[c]) {
          occ[b] = occ[c] = occ[a] === BODY && occ[d] === BODY ? BODY : RING;
          changed = true;
        } else if (occ[b] && occ[c] && !occ[a] && !occ[d]) {
          occ[a] = occ[d] = occ[b] === BODY && occ[c] === BODY ? BODY : RING;
          changed = true;
        }
      }
    }
    if (!changed) return pass;
  }
  return maxPasses;
}

/** Remove componentes (4-vizinhança) com menos de `minCells` células. */
export function removeSmallComponents(
  occ: Uint8Array,
  gx: number,
  gy: number,
  minCells: number,
): number {
  const { labels, sizes } = labelComponents(occ, gx, gy);
  let kept = 0;
  for (const size of sizes) if (size >= minCells) kept++;
  if (kept !== sizes.length) {
    for (let p = 0; p < occ.length; p++) {
      if (labels[p] !== 0 && sizes[labels[p] - 1] < minCells) occ[p] = FREE;
    }
  }
  return kept;
}

function bodyMask(
  layout: Layout,
  style: AdvancedParams['style'],
  figure: Figure,
  work: { w: number; h: number },
  smooth: Field | null,
): Uint8Array {
  const { gx, gy, s } = layout;
  let body: Uint8Array = new Uint8Array(gx * gy);
  const eps = 1e-9;

  if (style === 'contour' && smooth) {
    // Suave: a margem é uma distância euclidiana exata ao redor da figura.
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        body[j * gx + i] = smooth((i + 0.5) * s, (j + 0.5) * s) >= 0 ? 1 : 0;
      }
    }
    fillHoles(body, gx, gy);
    return body;
  }

  if (style === 'contour') {
    for (let j = 0; j < gy; j++) {
      const py = Math.floor(layout.srcY0 + ((j + 0.5) * s - layout.contentV0) / layout.mmPerPx);
      if (py < 0 || py >= work.h) continue;
      for (let i = 0; i < gx; i++) {
        const px = Math.floor(layout.srcX0 + ((i + 0.5) * s - layout.contentU0) / layout.mmPerPx);
        if (px < 0 || px >= work.w) continue;
        body[j * gx + i] = figure.mask[py * work.w + px];
      }
    }
    body = dilateRound(body, gx, gy, Math.round(layout.marginMm / s));
    fillHoles(body, gx, gy);
    return body;
  }

  const cu = layout.bodyU0 + layout.bodyW / 2;
  const cv = layout.bodyV0 + layout.bodyH / 2;
  const r2 = (layout.bodyW / 2) * (layout.bodyW / 2) + eps;
  for (let j = 0; j < gy; j++) {
    const v = (j + 0.5) * s;
    for (let i = 0; i < gx; i++) {
      const u = (i + 0.5) * s;
      let inside: boolean;
      if (style === 'circle') {
        inside = (u - cu) * (u - cu) + (v - cv) * (v - cv) <= r2;
      } else {
        inside =
          u > layout.bodyU0 - eps && u < layout.bodyU0 + layout.bodyW + eps &&
          v > layout.bodyV0 - eps && v < layout.bodyV0 + layout.bodyH + eps;
      }
      body[j * gx + i] = inside ? 1 : 0;
    }
  }
  return body;
}

// Passo 6: disco da argola, ponte se necessário e, só então, o furo.
// Devolve a ponte criada (ou null), para o campo de distância incluí-la.
function addRing(occ: Uint8Array, layout: Layout): Bridge | null {
  const ring = layout.ring;
  if (!ring) return null;
  let bridge: Bridge | null = null;
  const { gx, gy, s } = layout;
  const outer2 = ring.outerR * ring.outerR;

  const inDisc = (i: number, j: number, r2: number) => {
    const du = (i + 0.5) * s - ring.u;
    const dv = (j + 0.5) * s - ring.v;
    return du * du + dv * dv <= r2;
  };

  // O disco encosta no corpo? (sobreposto ou vizinho em 4-vizinhança)
  let touches = false;
  let nearest = -1;
  let nearestD2 = Infinity;
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      const p = j * gx + i;
      if (occ[p] === BODY) {
        const du = (i + 0.5) * s - ring.u;
        const dv = (j + 0.5) * s - ring.v;
        const d2 = du * du + dv * dv;
        if (d2 < nearestD2) {
          nearestD2 = d2;
          nearest = p;
        }
      }
      if (!touches && inDisc(i, j, outer2)) {
        touches =
          occ[p] === BODY ||
          (i > 0 && occ[p - 1] === BODY) ||
          (i < gx - 1 && occ[p + 1] === BODY) ||
          (j > 0 && occ[p - gx] === BODY) ||
          (j < gy - 1 && occ[p + gx] === BODY);
      }
    }
  }

  if (!touches && nearest >= 0) {
    // Ponte: faixa de largura ringOuter/2 do centro da argola até a célula do
    // corpo mais próxima. A meia-largura mínima mantém a faixa contínua.
    const tu = ((nearest % gx) + 0.5) * s;
    const tv = (Math.floor(nearest / gx) + 0.5) * s;
    const half = Math.max(ring.outerR / 2, 0.75 * s);
    const half2 = half * half;
    bridge = { tu, tv, half };
    const eu = tu - ring.u;
    const ev = tv - ring.v;
    const len2 = eu * eu + ev * ev;
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const p = j * gx + i;
        if (occ[p] !== FREE) continue;
        const du = (i + 0.5) * s - ring.u;
        const dv = (j + 0.5) * s - ring.v;
        let t = len2 > 0 ? (du * eu + dv * ev) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qu = du - t * eu;
        const qv = dv - t * ev;
        if (qu * qu + qv * qv <= half2) occ[p] = RING;
      }
    }
  }

  // O disco inteiro é argola (plano), mesmo onde sobrepõe o corpo.
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      if (inDisc(i, j, outer2)) occ[j * gx + i] = RING;
    }
  }

  // Furo. Em grade grossa o disco pode não pegar nenhum centro de célula;
  // nesse caso escava a célula que contém o centro.
  const hole2 = ring.holeR * ring.holeR;
  let carved = 0;
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      if (inDisc(i, j, hole2)) {
        occ[j * gx + i] = FREE;
        carved++;
      }
    }
  }
  if (carved === 0) {
    const ci = Math.min(gx - 1, Math.max(0, Math.floor(ring.u / s)));
    const cj = Math.min(gy - 1, Math.max(0, Math.floor(ring.v / s)));
    occ[cj * gx + ci] = FREE;
  }
  return bridge;
}

/** Estágio C, passos 5 a 8. Lança BlankError se não sobrar corpo. */
export function buildMask(
  layout: Layout,
  p: Pick<AdvancedParams, 'style' | 'minIslandMm'>,
  figure: Figure,
  work: { w: number; h: number },
  sdf: Float32Array | null = null, // presente = acabamento suave
): MaskResult {
  const { gx, gy, s } = layout;
  const body = sdf ? bodyField(layout, p.style, sdf, work) : null;
  const occ = bodyMask(layout, p.style, figure, work, body);
  if (!occ.includes(BODY)) throw new BlankError();

  const bridge = addRing(occ, layout);
  fixPinches(occ, gx, gy);

  const minCells = (p.minIslandMm * p.minIslandMm) / (s * s);
  const components = removeSmallComponents(occ, gx, gy, minCells);
  if (!occ.includes(BODY)) throw new BlankError();

  const warnings: Warning[] = [];
  if (p.style === 'contour' && figure.fallback) warnings.push('contourFallback');
  if (components > 1) warnings.push('looseParts');
  return { occ, warnings, field: body ? withRing(body, layout, bridge) : null };
}
