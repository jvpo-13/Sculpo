import { fillHoles } from './grid';
import type { WorkImage } from './resample';

export interface BBox {
  x0: number; // inclusivo
  y0: number;
  x1: number; // exclusivo
  y1: number;
}

export interface Figure {
  mask: Uint8Array;   // w*h na resolução de trabalho
  bbox: BBox;
  fallback: boolean;  // true = não achamos o contorno; figura = imagem inteira
}

const BG_TOLERANCE = 24;

function median(values: Float32Array): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.floor(sorted.length / 2)];
}

// Cor de fundo = mediana por canal da moldura de 1 px.
function frameMedian(plane: Float32Array, w: number, h: number): number {
  const frame: number[] = [];
  for (let x = 0; x < w; x++) {
    frame.push(plane[x]);
    if (h > 1) frame.push(plane[(h - 1) * w + x]);
  }
  for (let y = 1; y < h - 1; y++) {
    frame.push(plane[y * w]);
    if (w > 1) frame.push(plane[y * w + w - 1]);
  }
  return median(Float32Array.from(frame));
}

/** Estágio C.1: máscara da figura (independe dos parâmetros tonais). */
export function computeFigure(work: WorkImage, hasAlpha: boolean): Figure {
  const { w, h } = work;
  const n = w * h;
  const mask = new Uint8Array(n);

  if (hasAlpha) {
    for (let p = 0; p < n; p++) mask[p] = work.a[p] >= 128 ? 1 : 0;
  } else {
    const br = frameMedian(work.r, w, h);
    const bg = frameMedian(work.g, w, h);
    const bb = frameMedian(work.b, w, h);
    for (let p = 0; p < n; p++) {
      const d = Math.max(
        Math.abs(work.r[p] - br),
        Math.abs(work.g[p] - bg),
        Math.abs(work.b[p] - bb),
      );
      mask[p] = d > BG_TOLERANCE ? 1 : 0;
    }
  }

  fillHoles(mask, w, h);

  let area = 0;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] === 0) continue;
      area++;
      if (x < x0) x0 = x;
      if (x + 1 > x1) x1 = x + 1;
      if (y < y0) y0 = y;
      if (y + 1 > y1) y1 = y + 1;
    }
  }

  if (area < 0.02 * n || area > 0.98 * n) {
    mask.fill(1);
    return { mask, bbox: { x0: 0, y0: 0, x1: w, y1: h }, fallback: true };
  }
  return { mask, bbox: { x0, y0, x1, y1 }, fallback: false };
}
