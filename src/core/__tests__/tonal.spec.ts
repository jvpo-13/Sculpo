import { describe, expect, it } from 'vitest';
import { quantizeLayers } from '../height';
import { resampleToWork, workSize } from '../resample';
import { computeTonal, tonalKey } from '../tonal';
import { BLACK, CLEAR, WHITE, hasNaN, makeRgba, params } from './helpers';

const N = 32;
const work = (fn: Parameters<typeof makeRgba>[2]) => resampleToWork(makeRgba(N, N, fn), N);
const half = work((x) => (x < N / 2 ? BLACK : WHITE));
const at = (t: Float32Array, x: number, y: number) => t[y * N + x];

describe('resample', () => {
  it('põe o maior lado em R preservando o aspecto (e amplia se menor)', () => {
    expect(workSize(1024, 512)).toEqual({ w: 512, h: 256 });
    expect(workSize(100, 200)).toEqual({ w: 256, h: 512 });
  });

  it('faz média de área e compõe transparência sobre branco', () => {
    const w = resampleToWork(makeRgba(4, 4, (x) => (x < 2 ? BLACK : CLEAR)), 2);
    expect([w.w, w.h]).toEqual([2, 2]);
    expect(Array.from(w.r)).toEqual([0, 255, 0, 255]);
    expect(Array.from(w.a)).toEqual([255, 0, 255, 0]);

    const mix = resampleToWork(makeRgba(2, 2, (x) => (x === 0 ? BLACK : WHITE)), 1);
    expect(mix.r[0]).toBeCloseTo(127.5, 4);
  });
});

describe('computeTonal', () => {
  it('branca = 1, preta = 0 no modo contínuo', () => {
    const p = params({ blurPx: 0 });
    expect(computeTonal(work(() => WHITE), p).every((v) => v === 1)).toBe(true);
    expect(computeTonal(work(() => BLACK), p).every((v) => v === 0)).toBe(true);
  });

  it('metade/metade e inversão', () => {
    const t = computeTonal(half, params({ blurPx: 0 }));
    expect(at(t, 2, 5)).toBe(0);
    expect(at(t, N - 3, 5)).toBe(1);

    const inv = computeTonal(half, params({ blurPx: 0, invert: true }));
    expect(at(inv, 2, 5)).toBe(1);
    expect(at(inv, N - 3, 5)).toBe(0);
  });

  it('threshold separa em 0 e 1', () => {
    const gray = work((x) => (x < N / 2 ? [100, 100, 100, 255] : [200, 200, 200, 255]));
    const p = params({ blurPx: 0, captureMode: 'threshold' });
    const t = computeTonal(gray, { ...p, threshold: 128 });
    expect(at(t, 0, 0)).toBe(0);
    expect(at(t, N - 1, 0)).toBe(1);
    expect(computeTonal(gray, { ...p, threshold: 90 }).every((v) => v === 1)).toBe(true);
    expect(computeTonal(gray, { ...p, threshold: 210 }).every((v) => v === 0)).toBe(true);
  });

  it('sobel acende só na borda vertical; imagem lisa fica toda em 0', () => {
    const t = computeTonal(half, params({ blurPx: 0, captureMode: 'sobel' }));
    expect(at(t, N / 2 - 1, 10)).toBe(1);
    expect(at(t, N / 2, 10)).toBe(1);
    expect(at(t, 3, 10)).toBe(0);
    expect(at(t, N - 4, 10)).toBe(0);

    const flat = computeTonal(work(() => WHITE), params({ captureMode: 'sobel' }));
    expect(flat.every((v) => v === 0)).toBe(true);
  });

  it('canais: alpha, vermelho e saturação', () => {
    const img = work((x) => (x < N / 2 ? [255, 0, 0, 255] : CLEAR));
    const p = params({ blurPx: 0 });
    const alpha = computeTonal(img, { ...p, channel: 'alpha' });
    expect([at(alpha, 0, 0), at(alpha, N - 1, 0)]).toEqual([1, 0]);
    const blue = computeTonal(img, { ...p, channel: 'blue' });
    expect([at(blue, 0, 0), at(blue, N - 1, 0)]).toEqual([0, 1]); // transparente = branco
    const sat = computeTonal(img, { ...p, channel: 'saturation' });
    expect([at(sat, 0, 0), at(sat, N - 1, 0)]).toEqual([1, 0]);
  });

  it('gama > 1 clareia e nunca gera NaN com brilho/contraste extremos', () => {
    const gray = work(() => [64, 64, 64, 255]);
    const base = computeTonal(gray, params({ blurPx: 0 }))[0];
    expect(computeTonal(gray, params({ blurPx: 0, gamma: 2 }))[0]).toBeGreaterThan(base);
    const extreme = computeTonal(half, params({ brightness: -100, contrast: 100, gamma: 2.5 }));
    expect(hasNaN(extreme)).toBe(false);
  });

  it('blur suaviza a borda; morfologia engrossa e afina', () => {
    const blurred = computeTonal(half, params({ blurPx: 2 }));
    const edge = at(blurred, N / 2, 10);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);

    const count = (t: Float32Array) => t.reduce((s, v) => s + v, 0);
    const p = params({ blurPx: 0, captureMode: 'threshold', threshold: 128 });
    const plain = count(computeTonal(half, p));
    expect(count(computeTonal(half, { ...p, morphology: 2 }))).toBe(plain + 2 * N);
    expect(count(computeTonal(half, { ...p, morphology: -2 }))).toBe(plain - 2 * N);
  });

  it('a chave de cache muda só com parâmetros tonais', () => {
    const p = params();
    const layoutOnly = { ...p, widthMm: 99, layers: 4 };
    expect(tonalKey(p)).toBe(tonalKey(layoutOnly));
    expect(tonalKey(p)).not.toBe(tonalKey({ ...p, gamma: 1.5 }));
  });
});

describe('quantizeLayers', () => {
  it('0 é contínuo; 2..6 quantiza em níveis iguais', () => {
    expect(quantizeLayers(0.37, 0)).toBe(0.37);
    expect(quantizeLayers(0.37, 2)).toBe(0);
    expect(quantizeLayers(0.6, 2)).toBe(1);
    expect(quantizeLayers(0.4, 3)).toBe(0.5);
    expect(quantizeLayers(0.85, 6)).toBeCloseTo(0.8, 10); // round(4.25)/5
  });
});
