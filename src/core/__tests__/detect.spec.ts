import { describe, expect, it } from 'vitest';
import { detect } from '../detect';
import { computeFigure } from '../figure';
import { resampleToWork } from '../resample';
import { BLACK, CLEAR, WHITE, makeRgba } from './helpers';

const N = 64;
const inSquare = (x: number, y: number) => x >= 20 && x < 44 && y >= 20 && y < 44;

describe('detect', () => {
  it('transparente com logo escuro -> canal alpha', () => {
    const d = detect(makeRgba(N, N, (x, y) => (inSquare(x, y) ? BLACK : CLEAR)));
    expect(d).toMatchObject({
      channel: 'alpha', captureMode: 'threshold', threshold: 128, invert: false,
      hasAlpha: true, blank: false,
    });
  });

  it('desenho preto em fundo branco -> threshold invertido', () => {
    const d = detect(makeRgba(N, N, (x, y) => (inSquare(x, y) ? BLACK : WHITE)));
    expect(d).toMatchObject({
      channel: 'luma', captureMode: 'threshold', invert: true, hasAlpha: false, blank: false,
    });
  });

  it('foto em gradiente -> contínuo', () => {
    const d = detect(makeRgba(N, N, (x) => {
      const v = Math.round((x / (N - 1)) * 255);
      return [v, v, v, 255];
    }));
    expect(d).toMatchObject({
      channel: 'luma', captureMode: 'continuous', invert: false, blank: false, lowContrast: false,
    });
  });

  it('sem desenho: toda branca e toda transparente são blank', () => {
    expect(detect(makeRgba(N, N, () => WHITE)).blank).toBe(true);
    expect(detect(makeRgba(N, N, () => CLEAR)).blank).toBe(true);
    // Forma branca sobre transparente NÃO é blank (o alpha varia).
    expect(detect(makeRgba(N, N, (x, y) => (inSquare(x, y) ? WHITE : [255, 255, 255, 0]))).blank).toBe(false);
  });

  it('contraste baixo avisa sem bloquear', () => {
    const d = detect(makeRgba(N, N, (x) => (x < N / 2 ? [120, 120, 120, 255] : [140, 140, 140, 255])));
    expect(d.blank).toBe(false);
    expect(d.lowContrast).toBe(true);
    expect(d.lumaStdDev).toBeCloseTo(10, 5);
  });
});

describe('computeFigure', () => {
  const fig = (fn: Parameters<typeof makeRgba>[2], hasAlpha: boolean) =>
    computeFigure(resampleToWork(makeRgba(N, N, fn), N), hasAlpha);

  it('com alpha: figura = pixels opacos, com a caixa certa', () => {
    const f = fig((x, y) => (inSquare(x, y) ? BLACK : CLEAR), true);
    expect(f.fallback).toBe(false);
    expect(f.bbox).toEqual({ x0: 20, y0: 20, x1: 44, y1: 44 });
  });

  it('sem alpha: separa pelo fundo da moldura e preenche buracos', () => {
    // Quadrado preto com miolo branco: o miolo é buraco e vira figura.
    const hollow = (x: number, y: number) => inSquare(x, y) && !(x >= 28 && x < 36 && y >= 28 && y < 36);
    const f = fig((x, y) => (hollow(x, y) ? BLACK : WHITE), false);
    expect(f.fallback).toBe(false);
    expect(f.mask[32 * N + 32]).toBe(1);
    expect(f.mask[2 * N + 2]).toBe(0);
  });

  it('figura minúscula ou total -> imagem inteira com fallback', () => {
    const tiny = fig((x, y) => (x === 30 && y === 30 ? BLACK : WHITE), false);
    expect(tiny.fallback).toBe(true);
    expect(tiny.bbox).toEqual({ x0: 0, y0: 0, x1: N, y1: N });
    expect(fig(() => BLACK, true).fallback).toBe(true);
  });
});
