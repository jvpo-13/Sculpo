import { describe, expect, it } from 'vitest';
import { buildMesh } from '../mesh';
import { buildSTL } from '../stl';

function parseSTL(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const header = String.fromCharCode(...new Uint8Array(buffer, 0, 80));
  const count = view.getUint32(80, true);
  const tri = (t: number) => {
    const o = 84 + t * 50;
    const f = (k: number) => view.getFloat32(o + k * 4, true);
    return {
      normal: [f(0), f(1), f(2)],
      a: [f(3), f(4), f(5)],
      b: [f(6), f(7), f(8)],
      c: [f(9), f(10), f(11)],
      attr: view.getUint16(o + 48, true),
    };
  };
  return { header, count, tri };
}

describe('buildSTL', () => {
  // Heightmap 10x10: plano perto da origem da grade, ondulado no resto.
  const n = 10;
  const occ = new Uint8Array(n * n).fill(1);
  const h = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) h[j * n + i] = i < 3 && j < 3 ? 1 : 1 + ((i * j) % 4) * 0.25;
  const mesh = buildMesh(occ, h, n, n, 1, 2);
  const buffer = buildSTL(mesh.positions, mesh.indices);
  const stl = parseSTL(buffer);

  it('header, contagem e tamanho', () => {
    expect(stl.header.startsWith('Sculpo STL binary')).toBe(true);
    expect(stl.header.slice(17)).toBe('\0'.repeat(63));
    expect(stl.count).toBe(mesh.indices.length / 3);
    expect(stl.count).toBe(n * n * 4 + 4 * n * 2);
    expect(buffer.byteLength).toBe(84 + 50 * stl.count);
  });

  it('primeira normal e primeiro triângulo', () => {
    const t = stl.tri(0);
    expect(t.normal).toEqual([0, 0, 1]); // topo plano
    expect(t.attr).toBe(0);
    expect(t.a).toEqual([0, 9, 3]);      // canto inferior esquerdo da célula (0,0)
    expect(t.b).toEqual([1, 9, 3]);
    expect(t.c).toEqual([1, 10, 3]);
  });

  it('todas as normais são unitárias e batem com o winding', () => {
    for (let t = 0; t < stl.count; t++) {
      const { normal, a, b, c } = stl.tri(t);
      expect(Math.hypot(normal[0], normal[1], normal[2])).toBeCloseTo(1, 5);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const dot = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2];
      expect(dot).toBeGreaterThan(0);
    }
  });

  it('triângulo degenerado recebe normal (0,0,1)', () => {
    const flat = buildSTL(Float32Array.from([0, 0, 0, 1, 1, 1, 2, 2, 2]), Uint32Array.from([0, 1, 2]));
    expect(parseSTL(flat).tri(0).normal).toEqual([0, 0, 1]);
  });

  it('é determinístico byte a byte', () => {
    const again = new Uint8Array(buildSTL(mesh.positions, mesh.indices));
    expect(Array.from(again)).toEqual(Array.from(new Uint8Array(buffer)));
  });
});
