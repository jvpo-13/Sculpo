import type { AdvancedParams } from '../types';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// Teto da malha na exportação em alta (~1 milhão de triângulos, ~50 MB).
export const MAX_EXPORT_RESOLUTION = 500;

/**
 * Parte 3.5: clamps silenciosos aos ranges de AdvancedParams.
 * `resolutionScale` > 1 é a exportação em alta: multiplica a resolução DEPOIS
 * do clamp normal, até MAX_EXPORT_RESOLUTION.
 */
export function clampParams(p: AdvancedParams, resolutionScale = 1): AdvancedParams {
  const ringOuterMm = clamp(p.ringOuterMm, 4, 12);
  // Parede mínima de 1,2 mm em volta do furo.
  const ringHoleMm = Math.min(clamp(p.ringHoleMm, 1.5, 6), ringOuterMm - 2.4);
  const layers = Math.round(clamp(p.layers, 0, 6));

  return {
    ...p,
    threshold: clamp(p.threshold, 0, 255),
    brightness: clamp(p.brightness, -100, 100),
    contrast: clamp(p.contrast, -100, 100),
    gamma: clamp(p.gamma, 0.4, 2.5),
    blurPx: Math.round(clamp(p.blurPx, 0, 5)),
    morphology: Math.round(clamp(p.morphology, -3, 3)),
    layers: layers === 1 ? 0 : layers, // 1 nível não existe: é contínuo
    widthMm: clamp(p.widthMm, 20, 200),
    baseThicknessMm: clamp(p.baseThicknessMm, 1.2, 5),
    maxReliefMm: clamp(p.maxReliefMm, 0.4, 6),
    marginMm: clamp(p.marginMm, 0, 10),
    ringPosX: clamp(p.ringPosX, -1, 1),
    ringPosY: clamp(p.ringPosY, -1, 1),
    ringOuterMm,
    ringHoleMm,
    minIslandMm: clamp(p.minIslandMm, 0, 3),
    meshResolution: Math.min(
      MAX_EXPORT_RESOLUTION,
      Math.round(Math.round(clamp(p.meshResolution, 80, 250)) * Math.max(1, resolutionScale)),
    ),
    surface: p.surface === 'pixelated' ? 'pixelated' : 'smooth',
  };
}
