import { describe, expect, it } from 'vitest';
import { DEFAULT_DETECTED, deriveAdvanced } from '../derive';
import type { BasicParams, Detected } from '../../types';

const basico: BasicParams = {
  style: 'contour',
  size: 'M',
  reliefType: 'raised',
  ringPosition: 'top',
};

describe('deriveAdvanced', () => {
  it('mapeia P/M/G para 40/55/70 mm e mantém os padrões fixos', () => {
    expect(deriveAdvanced({ ...basico, size: 'P' }, DEFAULT_DETECTED).widthMm).toBe(40);
    expect(deriveAdvanced({ ...basico, size: 'M' }, DEFAULT_DETECTED).widthMm).toBe(55);
    expect(deriveAdvanced({ ...basico, size: 'G' }, DEFAULT_DETECTED).widthMm).toBe(70);

    const a = deriveAdvanced(basico, DEFAULT_DETECTED);
    expect(a).toMatchObject({
      style: 'contour',
      reliefType: 'raised',
      brightness: 0,
      contrast: 0,
      gamma: 1,
      morphology: 0,
      layers: 0,
      baseThicknessMm: 2.0,
      maxReliefMm: 1.5,
      marginMm: 2.0,
      protectiveBorder: false,
      ringOuterMm: 8,
      ringHoleMm: 4,
      minIslandMm: 0.8,
      meshResolution: 160,
    });
  });

  it('posiciona a argola: topo (0,1), lateral (-1,0), nenhuma desliga', () => {
    const topo = deriveAdvanced({ ...basico, ringPosition: 'top' }, DEFAULT_DETECTED);
    expect([topo.ringEnabled, topo.ringPosX, topo.ringPosY]).toEqual([true, 0, 1]);

    const lado = deriveAdvanced({ ...basico, ringPosition: 'side' }, DEFAULT_DETECTED);
    expect([lado.ringEnabled, lado.ringPosX, lado.ringPosY]).toEqual([true, -1, 0]);

    const sem = deriveAdvanced({ ...basico, ringPosition: 'none' }, DEFAULT_DETECTED);
    expect(sem.ringEnabled).toBe(false);
  });

  it('copia a detecção e só aplica blur no modo contínuo', () => {
    const logo: Detected = {
      ...DEFAULT_DETECTED,
      channel: 'alpha',
      captureMode: 'threshold',
      threshold: 128,
      invert: false,
      hasAlpha: true,
    };
    const a = deriveAdvanced({ ...basico, style: 'circle', reliefType: 'engraved' }, logo);
    expect(a).toMatchObject({
      style: 'circle',
      reliefType: 'engraved',
      channel: 'alpha',
      captureMode: 'threshold',
      threshold: 128,
      invert: false,
      blurPx: 0,
    });

    const desenho: Detected = { ...DEFAULT_DETECTED, captureMode: 'threshold', invert: true };
    expect(deriveAdvanced(basico, desenho)).toMatchObject({ invert: true, blurPx: 0 });

    expect(deriveAdvanced(basico, DEFAULT_DETECTED).blurPx).toBe(1);
  });

  it('é determinística e não altera as entradas', () => {
    const b = Object.freeze({ ...basico });
    const d = Object.freeze({ ...DEFAULT_DETECTED });
    expect(deriveAdvanced(b, d)).toEqual(deriveAdvanced(b, d));
  });
});
