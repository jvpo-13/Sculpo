import { describe, expect, it } from 'vitest';
import { computeFigure } from '../figure';
import { fillHoles, labelComponents } from '../grid';
import { computeLayout } from '../layout';
import { BODY, FREE, RING, buildMask, fixPinches, removeSmallComponents } from '../mask';
import { resampleToWork } from '../resample';
import { BLACK, CLEAR, makeRgba, params } from './helpers';

function pinchCount(occ: Uint8Array, gx: number, gy: number): number {
  let n = 0;
  for (let j = 0; j < gy - 1; j++) {
    for (let i = 0; i < gx - 1; i++) {
      const a = occ[j * gx + i], b = occ[j * gx + i + 1];
      const c = occ[(j + 1) * gx + i], d = occ[(j + 1) * gx + i + 1];
      if ((a && d && !b && !c) || (b && c && !a && !d)) n++;
    }
  }
  return n;
}

// Disco opaco sobre fundo transparente, 128x128.
const N = 128;
const disc = makeRgba(N, N, (x, y) => ((x - 64) ** 2 + (y - 64) ** 2 <= 40 ** 2 ? BLACK : CLEAR));

function maskFor(patch: Parameters<typeof params>[0]) {
  const p = params(patch);
  const work = resampleToWork(disc, N);
  const figure = computeFigure(work, true);
  const layout = computeLayout(p, work, figure.bbox);
  return { layout, ...buildMask(layout, p, figure, work) };
}

describe('fixPinches', () => {
  it('preenche as duas células livres de um 2x2 diagonal', () => {
    const occ = Uint8Array.from([1, 0, 0, 1]);
    fixPinches(occ, 2, 2);
    expect(Array.from(occ)).toEqual([1, 1, 1, 1]);
  });

  it('estabiliza uma escada diagonal inteira', () => {
    const n = 8;
    const occ = new Uint8Array(n * n);
    for (let k = 0; k < n; k++) occ[k * n + k] = BODY;
    expect(pinchCount(occ, n, n)).toBe(n - 1);
    fixPinches(occ, n, n);
    expect(pinchCount(occ, n, n)).toBe(0);
    expect(labelComponents(occ, n, n).sizes.length).toBe(1);
  });

  it('célula criada entre corpo e argola é argola (relevo 0)', () => {
    const occ = Uint8Array.from([BODY, 0, 0, RING]);
    fixPinches(occ, 2, 2);
    expect(Array.from(occ)).toEqual([BODY, RING, RING, RING]);
  });
});

describe('removeSmallComponents', () => {
  it('remove ilhas abaixo do mínimo e conta as que ficam', () => {
    // 5x3: um bloco 2x2 + 1 célula isolada.
    const occ = Uint8Array.from([
      1, 1, 0, 0, 0,
      1, 1, 0, 0, 1,
      0, 0, 0, 0, 0,
    ]);
    expect(removeSmallComponents(occ, 5, 3, 2)).toBe(1);
    expect(occ[9]).toBe(FREE);
    expect(occ[0]).toBe(BODY);
  });
});

describe('buildMask', () => {
  it('argola longe do corpo é ligada por ponte e o furo é preservado', () => {
    // Contorno redondo com a argola no canto: o disco não encosta no corpo.
    const { occ, layout, warnings } = maskFor({
      style: 'contour', ringEnabled: true, ringPosX: 1, ringPosY: 1,
    });
    const { gx, gy, s } = layout;
    const ring = layout.ring!;

    expect(labelComponents(occ, gx, gy).sizes.length).toBe(1);
    expect(warnings).not.toContain('looseParts');
    expect(pinchCount(occ, gx, gy)).toBe(0);

    // Existe ponte: células de argola fora do disco externo.
    let bridge = 0;
    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const d = Math.hypot((i + 0.5) * s - ring.u, (j + 0.5) * s - ring.v);
        if (occ[j * gx + i] === RING && d > ring.outerR + s) bridge++;
      }
    }
    expect(bridge).toBeGreaterThan(0);

    // Furo: célula do centro livre e cercada de material.
    const center = Math.floor(ring.v / s) * gx + Math.floor(ring.u / s);
    expect(occ[center]).toBe(FREE);
    const filled = Uint8Array.from(occ);
    fillHoles(filled, gx, gy);
    expect(filled[center]).toBe(1);
  });

  it('argola no topo encosta direto (sem ponte) e forma uma peça só', () => {
    const { occ, layout } = maskFor({ style: 'rect', ringEnabled: true, ringPosX: 0, ringPosY: 1 });
    expect(labelComponents(occ, layout.gx, layout.gy).sizes.length).toBe(1);
    expect(occ.includes(RING)).toBe(true);
  });

  it('furo nunca some, mesmo em grade grossa', () => {
    const { occ, layout } = maskFor({
      style: 'rect', widthMm: 200, meshResolution: 80, ringEnabled: true,
      ringOuterMm: 4, ringHoleMm: 1.5,
    });
    const ring = layout.ring!;
    const center = Math.floor(ring.v / layout.s) * layout.gx + Math.floor(ring.u / layout.s);
    expect(occ[center]).toBe(FREE);
  });

  it('círculo e quadrado ocupam a área esperada', () => {
    const circle = maskFor({ style: 'circle' });
    const cells = circle.occ.reduce((n, v) => n + (v ? 1 : 0), 0);
    const area = cells * circle.layout.s ** 2;
    expect(area / (Math.PI * 27.5 ** 2)).toBeCloseTo(1, 2);

    const square = maskFor({ style: 'square' });
    expect(square.occ.every((v) => v === BODY)).toBe(true);
    expect([square.layout.gx, square.layout.gy]).toEqual([160, 160]);
  });
});

describe('computeLayout', () => {
  it('rect: maior lado = largura; argola no topo aumenta só a altura total', () => {
    const work = { w: 512, h: 256 };
    const bbox = { x0: 0, y0: 0, x1: 512, y1: 256 };
    const plain = computeLayout(params({ style: 'rect' }), work, bbox);
    expect(plain.bodyW).toBeCloseTo(55, 9);
    expect(plain.bodyH).toBeCloseTo(29.5, 9); // 51/2 + 2*2
    expect(plain.totalH).toBeCloseTo(29.5, 9);
    expect(plain.gx).toBe(160);

    const ring = computeLayout(params({ style: 'rect', ringEnabled: true }), work, bbox);
    expect(ring.totalW).toBeCloseTo(55, 9);
    expect(ring.totalH).toBeCloseTo(36, 9); // 29.5 + raio 4 + d 2.5
    expect(ring.bodyV0).toBeCloseTo(6.5, 9);
  });

  it('círculo: meia-diagonal do conteúdo = L/2 - margem', () => {
    const l = computeLayout(params({ style: 'circle' }), { w: 512, h: 384 }, { x0: 0, y0: 0, x1: 512, y1: 384 });
    const halfDiag = 0.5 * Math.hypot(l.srcW, l.srcH) * l.mmPerPx;
    expect(halfDiag).toBeCloseTo(27.5 - 2, 9);
    expect([l.bodyW, l.bodyH]).toEqual([55, 55]);
  });

  it('contour usa a caixa da figura; margem máxima não zera o conteúdo', () => {
    const l = computeLayout(
      params({ style: 'contour', widthMm: 20, marginMm: 10 }),
      { w: 512, h: 512 },
      { x0: 100, y0: 200, x1: 300, y1: 300 },
    );
    expect([l.srcX0, l.srcY0, l.srcW, l.srcH]).toEqual([100, 200, 200, 100]);
    expect(l.mmPerPx).toBeGreaterThan(0);
    expect(l.bodyW).toBeCloseTo(20, 9);
  });
});
