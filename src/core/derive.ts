import type { AdvancedParams, BasicParams, Detected, SizePreset } from '../types';

// Maior lado do corpo (mm) para cada tamanho do Modo Básico.
export const SIZE_MM: Record<SizePreset, number> = { P: 40, M: 55, G: 70 };

// Detecção neutra, usada enquanto nenhuma imagem foi carregada.
export const DEFAULT_DETECTED: Detected = {
  channel: 'luma',
  captureMode: 'continuous',
  threshold: 128,
  invert: false,
  hasAlpha: false,
  lumaStdDev: 0,
  blank: false,
  lowContrast: false,
};

/**
 * Converte as 4 escolhas do Modo Básico + a auto-detecção nos parâmetros
 * completos do pipeline. Função pura: mesma entrada, mesma saída.
 */
export function deriveAdvanced(basic: BasicParams, detected: Detected): AdvancedParams {
  const ringEnabled = basic.ringPosition !== 'none';
  // top: (0,1) — side: (-1,0). Com 'none' a posição não é usada; fica no topo.
  const side = basic.ringPosition === 'side';

  return {
    style: basic.style,
    reliefType: basic.reliefType,

    channel: detected.channel,
    captureMode: detected.captureMode,
    threshold: detected.threshold,
    brightness: 0,
    contrast: 0,
    gamma: 1,
    invert: detected.invert,
    blurPx: detected.captureMode === 'continuous' ? 1 : 0,
    morphology: 0,
    layers: 0,

    widthMm: SIZE_MM[basic.size],
    baseThicknessMm: 2.0,
    maxReliefMm: 1.5,
    marginMm: 2.0,
    protectiveBorder: false,

    ringEnabled,
    ringPosX: side ? -1 : 0,
    ringPosY: side ? 0 : 1,
    ringOuterMm: 8,
    ringHoleMm: 4,
    minIslandMm: 0.8,
    meshResolution: 160,
    surface: 'smooth',
  };
}
