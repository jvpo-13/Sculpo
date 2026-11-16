import type { AdvancedParams, BuildStats, Detected, SurfaceStyle, Warning } from '../types';
import { detect } from './detect';
import { figureSdf } from './field';
import { computeFigure, type Figure } from './figure';
import { buildPreview, computeHeights } from './height';
import { computeLayout } from './layout';
import { buildMask } from './mask';
import { buildMesh } from './mesh';
import { clampParams } from './params';
import { resampleToWork, type Rgba, type WorkImage } from './resample';
import { buildSmoothMesh } from './smoothMesh';
import { computeTonal, tonalKey } from './tonal';

/** O que depende da imagem E do acabamento (suave ou pixelado). */
export interface Variant {
  work: WorkImage;
  figure: Figure;
  sdf: Float32Array | null; // distância com sinal da figura; só no suave
}

/** Tudo o que depende só da imagem (calculado no `load`). */
export interface Source {
  rgba: Rgba;
  detected: Detected;
  // Variantes criadas sob demanda e guardadas.
  variants: Partial<Record<SurfaceStyle, Variant>>;
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

function getVariant(source: Source, surface: SurfaceStyle): Variant {
  const cached = source.variants[surface];
  if (cached) return cached;
  const smooth = surface === 'smooth';
  const work = resampleToWork(source.rgba, undefined, smooth);
  const figure = computeFigure(work, source.detected.hasAlpha);
  const variant: Variant = {
    work,
    figure,
    sdf: smooth ? figureSdf(figure.mask, work.w, work.h) : null,
  };
  source.variants[surface] = variant;
  return variant;
}

export function prepareSource(rgba: Rgba): Source {
  const source: Source = { rgba, detected: detect(rgba), variants: {} };
  getVariant(source, 'smooth'); // o padrão já fica pronto no carregamento
  return source;
}

/**
 * Estágios B a E. Determinístico: mesma fonte + mesmos parâmetros geram
 * buffers idênticos. Lança BlankError se não houver corpo.
 *
 * `resolutionScale` multiplica a resolução da malha (exportação em alta).
 */
export function buildModel(
  source: Source,
  rawParams: AdvancedParams,
  cache: TonalCache | null = null,
  resolutionScale = 1,
): BuildOutput {
  const p = clampParams(rawParams, resolutionScale);
  const { work, figure, sdf } = getVariant(source, p.surface);

  const key = tonalKey(p);
  const tonal = cache && cache.key === key ? cache.tonal : computeTonal(work, p);

  const layout = computeLayout(p, work, figure.bbox);
  const mask = buildMask(layout, p, figure, work, sdf);
  const v = computeHeights(layout, mask.occ, tonal, work, p, mask.field);

  const heightMm = new Float32Array(v.length);
  for (let q = 0; q < v.length; q++) heightMm[q] = v[q] * p.maxReliefMm;
  // Suave: contorno recortado pela curva real. Pixelado: prisma sobre a grade.
  const mesh = mask.field
    ? buildSmoothMesh(mask.occ, heightMm, mask.field, layout.gx, layout.gy, layout.s, p.baseThicknessMm)
    : buildMesh(mask.occ, heightMm, layout.gx, layout.gy, layout.s, p.baseThicknessMm);

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
