import type { AdvancedParams } from '../types';
import type { BBox } from './figure';

// O conteúdo nunca fica menor que isto, mesmo com margem máxima.
const MIN_CONTENT_MM = 4;

/**
 * Geometria do chaveiro em mm. Coordenadas (u, v) com origem no canto
 * SUPERIOR esquerdo da caixa total e v crescendo para baixo (como a imagem).
 */
export interface Layout {
  s: number;        // mm por célula
  gx: number;
  gy: number;
  totalW: number;
  totalH: number;
  bodyW: number;
  bodyH: number;
  bodyU0: number;
  bodyV0: number;
  contentU0: number;
  contentV0: number;
  mmPerPx: number;  // escala da imagem de trabalho
  srcX0: number;    // retângulo do conteúdo na imagem de trabalho (px)
  srcY0: number;
  srcW: number;
  srcH: number;
  marginMm: number; // margem efetiva
  ring: { u: number; v: number; outerR: number; holeR: number } | null;
}

type LayoutParams = Pick<
  AdvancedParams,
  | 'style' | 'widthMm' | 'marginMm' | 'ringEnabled' | 'ringPosX' | 'ringPosY'
  | 'ringOuterMm' | 'ringHoleMm' | 'meshResolution'
>;

/** Estágio C, passos 2 a 4. */
export function computeLayout(
  p: LayoutParams,
  work: { w: number; h: number },
  bbox: BBox,
): Layout {
  const L = p.widthMm;
  const m = Math.max(0, Math.min(p.marginMm, (L - MIN_CONTENT_MM) / 2));

  let srcX0 = 0, srcY0 = 0, srcW = work.w, srcH = work.h;
  if (p.style === 'contour') {
    srcX0 = bbox.x0;
    srcY0 = bbox.y0;
    srcW = Math.max(1, bbox.x1 - bbox.x0);
    srcH = Math.max(1, bbox.y1 - bbox.y0);
  }

  let mmPerPx: number;
  let bodyW: number;
  let bodyH: number;
  if (p.style === 'circle') {
    // Meia-diagonal do conteúdo = L/2 - m.
    mmPerPx = (L / 2 - m) / (0.5 * Math.sqrt(srcW * srcW + srcH * srcH));
    bodyW = bodyH = L;
  } else {
    mmPerPx = (L - 2 * m) / Math.max(srcW, srcH);
    if (p.style === 'square') {
      bodyW = bodyH = L;
    } else {
      bodyW = srcW * mmPerPx + 2 * m;
      bodyH = srcH * mmPerPx + 2 * m;
    }
  }
  const contentW = srcW * mmPerPx;
  const contentH = srcH * mmPerPx;

  // Em coordenadas locais do corpo (canto superior esquerdo = 0,0).
  let minU = 0, minV = 0, maxU = bodyW, maxV = bodyH;
  let ring: Layout['ring'] = null;
  if (p.ringEnabled) {
    const outerR = p.ringOuterMm / 2;
    const d = outerR - 1.5; // sobreposição de 1,5 mm quando |pos| = 1
    const u = bodyW / 2 + p.ringPosX * (bodyW / 2 + d);
    const v = bodyH / 2 - p.ringPosY * (bodyH / 2 + d); // ringPosY = 1 é o topo
    ring = { u, v, outerR, holeR: p.ringHoleMm / 2 };
    minU = Math.min(minU, u - outerR);
    minV = Math.min(minV, v - outerR);
    maxU = Math.max(maxU, u + outerR);
    maxV = Math.max(maxV, v + outerR);
  }

  const totalW = maxU - minU;
  const totalH = maxV - minV;
  const s = Math.max(totalW, totalH) / p.meshResolution;
  // O epsilon evita uma coluna extra por erro de arredondamento.
  const gx = Math.max(1, Math.ceil(totalW / s - 1e-9));
  const gy = Math.max(1, Math.ceil(totalH / s - 1e-9));

  const bodyU0 = -minU;
  const bodyV0 = -minV;
  if (ring) {
    ring.u -= minU;
    ring.v -= minV;
  }

  return {
    s, gx, gy, totalW, totalH, bodyW, bodyH, bodyU0, bodyV0,
    contentU0: bodyU0 + (bodyW - contentW) / 2,
    contentV0: bodyV0 + (bodyH - contentH) / 2,
    mmPerPx, srcX0, srcY0, srcW, srcH,
    marginMm: m,
    ring,
  };
}
