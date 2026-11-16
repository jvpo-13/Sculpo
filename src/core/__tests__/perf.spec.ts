import { describe, expect, it } from 'vitest';
import { buildModel, prepareSource } from '../pipeline';
import { buildSTL } from '../stl';
import { computeTonal } from '../tonal';
import { makeRgba, params } from './helpers';

// Alvos da Parte 6, com folga de 3x para CI.
const SLACK = 3;
const TARGET_TONAL_MS = 40;
const TARGET_BUILD_160_MS = 120;
const TARGET_BUILD_250_MS = 400;

// Melhor de 3 execuções: mede o algoritmo, não o aquecimento do JIT.
function best(fn: () => void): number {
  let min = Infinity;
  for (let k = 0; k < 3; k++) {
    const t0 = performance.now();
    fn();
    min = Math.min(min, performance.now() - t0);
  }
  return min;
}

describe('desempenho', () => {
  const photo = makeRgba(1024, 1024, (x, y) => {
    const v = Math.round(127.5 + 127.5 * Math.sin(x / 37) * Math.cos(y / 23));
    return [v, (v * 3) % 256, 255 - v, 255];
  });
  const source = prepareSource(photo);

  it('Estágio B em R=512', () => {
    const p = params({ blurPx: 5, morphology: 3, gamma: 1.4, contrast: 20 });
    expect(best(() => computeTonal(source.variants.smooth!.work, p))).toBeLessThan(TARGET_TONAL_MS * SLACK);
  });

  it('build completo a 160', () => {
    const p = params({ style: 'contour', ringEnabled: true, meshResolution: 160 });
    expect(best(() => buildModel(source, p))).toBeLessThan(TARGET_BUILD_160_MS * SLACK);
  });

  it('build completo a 250, incluindo o STL', () => {
    const p = params({ style: 'rect', ringEnabled: true, meshResolution: 250 });
    const ms = best(() => {
      const out = buildModel(source, p);
      buildSTL(out.positions, out.indices);
    });
    expect(ms).toBeLessThan(TARGET_BUILD_250_MS * SLACK);
  });
});
