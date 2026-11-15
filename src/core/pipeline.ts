import type { AdvancedParams, BuildStats, Detected, Warning } from '../types';
import { detect } from './detect';
import { computeFigure, type Figure } from './figure';
import { buildPreview, computeHeights } from './height';
import { computeLayout } from './layout';
import { buildMask } from './mask';
import { buildMesh } from './mesh';
import { clampParams } from './params';
import { resampleToWork, type Rgba, type WorkImage } from './resample';
import { computeTonal, tonalKey } from './tonal';

/** Tudo o que depende só da imagem (calculado uma vez no `load`). */
export interface Source {
  work: WorkImage;
  figure: Figure;
  detected: Detected;
}

export interface TonalCache {
  key: string;
  tonal: Float32Array;
}

export interface BuildOutput {
  preview: { data: Uint8Array; w: number; h: number };
  positions: Float32Array;
  indices: Uint32Array;
  stats: Omit<BuildStats, 'ms'>;
  cache: TonalCache; // devolva na próxima chamada para pular o Estágio B
}

export function prepareSource(rgba: Rgba): Source {
  const detected = detect(rgba);
  const work = resampleToWork(rgba);
  const figure = computeFigure(work, detected.hasAlpha);
  return { work, figure, detected };
}

/**
 * Estágios B a E. Determinístico: mesma fonte + mesmos parâmetros geram
 * buffers idênticos. Lança BlankError se não houver corpo.
 */
export function buildModel(
  source: Source,
  rawParams: AdvancedParams,
  cache: TonalCache | null = null,
): BuildOutput {
  const p = clampParams(rawParams);
  const { work, figure } = source;

  const key = tonalKey(p);
  const tonal = cache && cache.key === key ? cache.tonal : computeTonal(work, p);

  const layout = computeLayout(p, work, figure.bbox);
  const mask = buildMask(layout, p, figure, work);
  const v = computeHeights(layout, mask.occ, tonal, work, p);

  const heightMm = new Float32Array(v.length);
  for (let q = 0; q < v.length; q++) heightMm[q] = v[q] * p.maxReliefMm;
  const mesh = buildMesh(mask.occ, heightMm, layout.gx, layout.gy, layout.s, p.baseThicknessMm);

  const warnings: Warning[] = [];
  if (source.detected.lowContrast) warnings.push('lowContrast');
  warnings.push(...mask.warnings);

  return {
    preview: { data: buildPreview(mask.occ, v), w: layout.gx, h: layout.gy },
    positions: mesh.positions,
    indices: mesh.indices,
    stats: {
      triangles: mesh.indices.length / 3,
      bodyMm: { w: layout.bodyW, h: layout.bodyH },
      totalMm: { w: layout.totalW, h: layout.totalH },
      colorSwapZ: p.baseThicknessMm,
      warnings,
    },
    cache: { key, tonal },
  };
}
