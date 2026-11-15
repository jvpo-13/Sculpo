import { describe, expect, it } from 'vitest';
import { buildMesh } from '../mesh';
import { buildModel, prepareSource } from '../pipeline';
import {
  BLACK, CLEAR, hasNaN, makeRgba, manifoldErrors, minZ, params, sameBytes, signedVolume,
} from './helpers';

const BASE = 2;

// Contagem independente de arestas de parede.
function wallCount(occ: Uint8Array, gx: number, gy: number): number {
  let n = 0;
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      if (!occ[j * gx + i]) continue;
      if (i === 0 || !occ[j * gx + i - 1]) n++;
      if (i === gx - 1 || !occ[j * gx + i + 1]) n++;
      if (j === 0 || !occ[(j - 1) * gx + i]) n++;
      if (j === gy - 1 || !occ[(j + 1) * gx + i]) n++;
    }
  }
  return n;
}

// Volume esperado calculado de forma independente, em float64, a partir da
// regra do spec: z do vértice = base + média das células ocupadas vizinhas.
// Com 2 triângulos por célula, os cantos da diagonal (BL e TR) pesam em dobro.
function expectedVolume(occ: Uint8Array, h: Float32Array, gx: number, gy: number, s: number): number {
  const z = (vi: number, vj: number) => {
    let sum = 0, cnt = 0;
    for (const [ci, cj] of [[vi - 1, vj - 1], [vi, vj - 1], [vi - 1, vj], [vi, vj]]) {
      if (ci < 0 || cj < 0 || ci >= gx || cj >= gy || !occ[cj * gx + ci]) continue;
      sum += h[cj * gx + ci];
      cnt++;
    }
    return Math.fround(BASE + sum / cnt);
  };
  let vol = 0;
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      if (!occ[j * gx + i]) continue;
      const tl = z(i, j), tr = z(i + 1, j), bl = z(i, j + 1), br = z(i + 1, j + 1);
      vol += (s * s * (2 * bl + 2 * tr + br + tl)) / 6;
    }
  }
  return vol;
}

function checkInvariants(occ: Uint8Array, h: Float32Array, gx: number, gy: number, s: number) {
  const mesh = buildMesh(occ, h, gx, gy, s, BASE);
  const again = buildMesh(occ, h, gx, gy, s, BASE);
  const cells = occ.reduce((n, v) => n + (v ? 1 : 0), 0);

  // a) fechada, 2-manifold, orientada
  expect(manifoldErrors(mesh.positions, mesh.indices)).toBe(0);
  // b) volume positivo e igual ao esperado
  const vol = signedVolume(mesh.positions, mesh.indices);
  const want = expectedVolume(occ, h, gx, gy, s);
  expect(vol).toBeGreaterThan(0);
  expect(Math.abs(vol - want) / want).toBeLessThan(1e-6);
  // c) fundo em z = 0 exato, sem NaN
  expect(minZ(mesh.positions)).toBe(0);
  expect(hasNaN(mesh.positions)).toBe(false);
  // d) contagem de triângulos
  expect(mesh.indices.length / 3).toBe(4 * cells + 2 * wallCount(occ, gx, gy));
  expect(mesh.indices.length / 3).toBeLessThanOrEqual(4 * gx * gy + 2 * wallCount(occ, gx, gy));
  // e) determinismo
  expect(sameBytes(mesh.positions, again.positions)).toBe(true);
  expect(sameBytes(mesh.indices, again.indices)).toBe(true);
  return { mesh, vol };
}

describe('buildMesh — invariantes 5.2', () => {
  it('bloco 4x4: volume = área x (base + relevo)', () => {
    const occ = new Uint8Array(16).fill(1);
    const h = new Float32Array(16).fill(1.5);
    const { mesh, vol } = checkInvariants(occ, h, 4, 4, 1);
    expect(vol).toBeCloseTo(16 * 3.5, 9);
    expect(mesh.indices.length / 3).toBe(16 * 4 + 16 * 2);
    expect(mesh.positions.length / 3).toBe(2 * 25);
  });

  it('bloco com furo: paredes internas fecham a malha', () => {
    const n = 6;
    const occ = new Uint8Array(n * n).fill(1);
    for (const c of [14, 15, 20, 21]) occ[c] = 0;
    const h = new Float32Array(n * n).fill(1);
    const { vol } = checkInvariants(occ, h, n, n, 0.5);
    expect(vol).toBeCloseTo(32 * 0.25 * 3, 9);
  });

  it('gradiente: relevo variável continua fechado', () => {
    const n = 8;
    const occ = new Uint8Array(n * n).fill(1);
    const h = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = (i / (n - 1)) * 2 + j * 0.1;
    checkInvariants(occ, h, n, n, 0.7);
  });

  it('forma irregular em L com alturas diferentes', () => {
    const occ = Uint8Array.from([
      1, 1, 0, 0,
      1, 1, 0, 0,
      1, 1, 1, 1,
      1, 1, 1, 1,
    ]);
    const h = Float32Array.from(occ, (v, k) => (v ? (k % 5) * 0.3 : 0));
    checkInvariants(occ, h, 4, 4, 1);
  });
});

describe('malha pelo pipeline completo', () => {
  const N = 256;
  // Estrela opaca sobre transparente: contorno côncavo.
  const star = makeRgba(N, N, (x, y) => {
    const dx = x - 128, dy = y - 128;
    const r = 60 + 40 * Math.cos(5 * Math.atan2(dy, dx));
    return dx * dx + dy * dy <= r * r ? BLACK : CLEAR;
  });
  const photo = makeRgba(N, N, (x, y) => {
    const v = Math.round(127.5 + 127.5 * Math.sin(x / 9) * Math.cos(y / 13));
    return [v, 255 - v, (x + y) % 256, 255];
  });

  it('contorno com argola: fechada, orientada e determinística', () => {
    const source = prepareSource(star);
    const p = params({ style: 'contour', channel: 'alpha', captureMode: 'threshold', ringEnabled: true });
    const a = buildModel(source, p);
    const b = buildModel(source, p);

    expect(manifoldErrors(a.positions, a.indices)).toBe(0);
    expect(signedVolume(a.positions, a.indices)).toBeGreaterThan(0);
    expect(minZ(a.positions)).toBe(0);
    expect(hasNaN(a.positions)).toBe(false);
    expect(sameBytes(a.positions, b.positions)).toBe(true);
    expect(sameBytes(a.indices, b.indices)).toBe(true);
    expect(sameBytes(a.preview.data, b.preview.data)).toBe(true);
    expect(a.stats.warnings).toEqual([]);
  });

  it('todos os estilos, com argola no canto e borda protetora, são 2-manifold', () => {
    const source = prepareSource(star);
    for (const style of ['contour', 'circle', 'square', 'rect'] as const) {
      const out = buildModel(source, params({
        style, channel: 'alpha', captureMode: 'sobel', meshResolution: 97,
        ringEnabled: true, ringPosX: -1, ringPosY: -1, protectiveBorder: true,
        reliefType: 'engraved', layers: 3,
      }));
      expect(manifoldErrors(out.positions, out.indices), style).toBe(0);
      expect(minZ(out.positions), style).toBe(0);
    }
  });

  it('resolução 250 fica abaixo de ~260k triângulos', () => {
    const out = buildModel(prepareSource(photo), params({ style: 'rect', meshResolution: 250 }));
    expect(out.preview.w).toBe(250);
    expect(out.stats.triangles).toBeGreaterThan(240_000);
    expect(out.stats.triangles).toBeLessThan(260_000);
    expect(manifoldErrors(out.positions, out.indices)).toBe(0);
  });
});
