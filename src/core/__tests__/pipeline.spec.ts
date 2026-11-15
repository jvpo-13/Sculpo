import { describe, expect, it } from 'vitest';
import { deriveAdvanced } from '../derive';
import { clampParams } from '../params';
import { buildModel, prepareSource } from '../pipeline';
import { BLACK, WHITE, makeRgba, params, sameBytes } from './helpers';

const N = 512;
// Quadrado preto central em fundo branco + um ponto solto de 6 px.
const inSquare = (x: number, y: number) => x >= 156 && x < 356 && y >= 156 && y < 356;
const inDot = (x: number, y: number) => x >= 60 && x < 66 && y >= 60 && y < 66;
const drawing = makeRgba(N, N, (x, y) => (inSquare(x, y) || inDot(x, y) ? BLACK : WHITE));
const source = prepareSource(drawing);
const basic = (patch = {}) =>
  ({ ...deriveAdvanced({ style: 'rect', size: 'M', reliefType: 'raised', ringPosition: 'none' }, source.detected), ...patch });

describe('buildModel', () => {
  it('desenho em fundo branco: desenho em relevo, margem na base', () => {
    const out = buildModel(source, basic());
    const { data, w, h } = out.preview;
    expect([w, h]).toEqual([160, 160]);
    expect(data[80 * w + 80]).toBe(255);  // centro do quadrado: relevo cheio
    expect(data[40 * w + 120]).toBe(32);  // fundo: só base
    expect(data[0]).toBe(32);             // margem
    expect(out.stats.bodyMm).toEqual({ w: 55, h: 55 });
    expect(out.stats.totalMm).toEqual({ w: 55, h: 55 });
    expect(out.stats.colorSwapZ).toBe(2);
  });

  it('entalhado inverte o relevo dentro do corpo', () => {
    const { data, w } = buildModel(source, basic({ reliefType: 'engraved' })).preview;
    expect(data[80 * w + 80]).toBe(32);
    expect(data[40 * w + 120]).toBe(255);
  });

  it('filtro de ilhas remove o ponto solto', () => {
    // O ponto fica perto da célula (22, 22) na grade de 160.
    const near = (data: Uint8Array, w: number) => {
      let max = 0;
      for (let j = 18; j < 27; j++) for (let i = 18; i < 27; i++) max = Math.max(max, data[j * w + i]);
      return max;
    };
    const kept = buildModel(source, basic({ minIslandMm: 0 })).preview;
    const removed = buildModel(source, basic({ minIslandMm: 0.8 })).preview;
    expect(near(kept.data, kept.w)).toBe(255);
    expect(near(removed.data, removed.w)).toBe(32);
  });

  it('borda protetora eleva a beirada sem mudar a dimensão externa', () => {
    const plain = buildModel(source, basic());
    const bordered = buildModel(source, basic({ protectiveBorder: true }));
    expect(bordered.preview.data[0]).toBe(255);
    // 1,2 mm / 0,34 mm por célula = 3 células: índices 0, 1 e 2.
    expect(bordered.preview.data[2 * 160 + 2]).toBe(255);
    expect(bordered.preview.data[3 * 160 + 3]).toBe(32);
    expect(bordered.preview.data[2 * 160 + 80]).toBe(255);
    expect(bordered.preview.data[3 * 160 + 80]).toBe(32);
    expect(bordered.stats.totalMm).toEqual(plain.stats.totalMm);
  });

  it('camadas quantizam o relevo contínuo', () => {
    const gradient = prepareSource(makeRgba(N, N, (x) => {
      const v = Math.round((x / (N - 1)) * 255);
      return [v, v, v, 255];
    }));
    const out = buildModel(gradient, params({ layers: 3, marginMm: 0 }));
    const levels = new Set(out.preview.data);
    expect([...levels].sort((a, b) => a - b)).toEqual([32, 144, 255]);
  });

  it('cache tonal: reutilizar dá resultado idêntico', () => {
    const first = buildModel(source, basic());
    const reused = buildModel(source, basic({ widthMm: 70 }), first.cache);
    const fresh = buildModel(source, basic({ widthMm: 70 }));
    expect(reused.cache.tonal).toBe(first.cache.tonal);
    expect(sameBytes(reused.positions, fresh.positions)).toBe(true);
    expect(sameBytes(reused.indices, fresh.indices)).toBe(true);

    const changed = buildModel(source, basic({ invert: false }), first.cache);
    expect(changed.cache.tonal).not.toBe(first.cache.tonal);
  });

  it('avisos: contorno não encontrado e partes soltas', () => {
    const dotOnly = prepareSource(makeRgba(N, N, (x, y) => (inDot(x, y) ? BLACK : WHITE)));
    expect(buildModel(dotOnly, params({ style: 'contour' })).stats.warnings).toContain('contourFallback');
    expect(buildModel(dotOnly, params({ style: 'rect' })).stats.warnings).not.toContain('contourFallback');

    // Dois blocos afastados: o contorno gera duas peças.
    const two = prepareSource(makeRgba(N, N, (x, y) =>
      y > 150 && y < 350 && ((x > 40 && x < 180) || (x > 330 && x < 470)) ? BLACK : WHITE));
    expect(buildModel(two, params({ style: 'contour' })).stats.warnings).toContain('looseParts');
  });
});

describe('clampParams', () => {
  it('garante parede mínima de 1,2 mm na argola', () => {
    expect(clampParams(params({ ringOuterMm: 6, ringHoleMm: 6 })).ringHoleMm).toBeCloseTo(3.6, 9);
    expect(clampParams(params({ ringOuterMm: 8, ringHoleMm: 4 })).ringHoleMm).toBe(4);
  });

  it('limita aos ranges e trata 1 camada como contínuo', () => {
    const c = clampParams(params({
      widthMm: 999, gamma: 0, meshResolution: 10, layers: 1, blurPx: 2.6, threshold: -5,
    }));
    expect(c).toMatchObject({
      widthMm: 200, gamma: 0.4, meshResolution: 80, layers: 0, blurPx: 3, threshold: 0,
    });
  });
});
