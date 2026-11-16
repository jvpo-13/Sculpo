import { describe, expect, it } from 'vitest';
import { edtSquared, figureSdf } from '../field';
import { buildModel, prepareSource, type BuildOutput } from '../pipeline';
import {
  BLACK, CLEAR, WHITE, hasNaN, makeRgba, manifoldErrors, minZ, params, sameBytes, signedVolume,
} from './helpers';

// Vértices do contorno: os do fundo (z = 0) que participam de alguma parede.
function outline(out: BuildOutput): [number, number][] {
  const { positions: P, indices: I } = out;
  const seen = new Set<number>();
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    const zs = tri.map((k) => P[k * 3 + 2]);
    if (zs.every((z) => z === 0) || zs.every((z) => z > 0)) continue;
    for (const k of tri) if (P[k * 3 + 2] === 0) seen.add(k);
  }
  return [...seen].map((k) => [P[k * 3], P[k * 3 + 1]]);
}

// Nenhum triângulo do topo aponta para baixo, nem do fundo para cima.
function flipped(out: BuildOutput): number {
  const { positions: P, indices: I } = out;
  let bad = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const top = P[a + 2] > 0 && P[b + 2] > 0 && P[c + 2] > 0;
    const bottom = P[a + 2] === 0 && P[b + 2] === 0 && P[c + 2] === 0;
    if (!top && !bottom) continue;
    const nz = (P[b] - P[a]) * (P[c + 1] - P[a + 1]) - (P[b + 1] - P[a + 1]) * (P[c] - P[a]);
    if (top ? nz <= 0 : nz >= 0) bad++;
  }
  return bad;
}

function bottomArea(out: BuildOutput): number {
  const { positions: P, indices: I } = out;
  let area = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    if (P[a + 2] !== 0 || P[b + 2] !== 0 || P[c + 2] !== 0) continue;
    area += Math.abs((P[b] - P[a]) * (P[c + 1] - P[a + 1]) - (P[b + 1] - P[a + 1]) * (P[c] - P[a])) / 2;
  }
  return area;
}

const N = 256;
const photo = prepareSource(makeRgba(N, N, (x, y) => {
  const v = Math.round(127.5 + 127.5 * Math.sin(x / 9) * Math.cos(y / 13));
  return [v, 255 - v, (x + y) % 256, 255];
}));
const star = prepareSource(makeRgba(N, N, (x, y) => {
  const dx = x - 128, dy = y - 128;
  const r = 60 + 40 * Math.cos(5 * Math.atan2(dy, dx));
  return dx * dx + dy * dy <= r * r ? BLACK : CLEAR;
}));

describe('contorno suave', () => {
  it('chaveiro redondo: os vértices da borda ficam SOBRE o círculo', () => {
    const radial = (surface: 'smooth' | 'pixelated') =>
      outline(buildModel(photo, params({ style: 'circle', surface }))).map(
        ([x, y]) => Math.abs(Math.hypot(x - 27.5, y - 27.5) - 27.5),
      );
    const smooth = radial('smooth');
    const pixel = radial('pixelated');
    expect(smooth.length).toBeGreaterThan(300);
    expect(Math.max(...smooth)).toBeLessThan(0.01);  // 10 micrômetros
    expect(Math.max(...pixel)).toBeGreaterThan(0.15); // a escada da grade
  });

  it('chaveiro redondo: a área bate com pi*r²', () => {
    const area = bottomArea(buildModel(photo, params({ style: 'circle' })));
    expect(area / (Math.PI * 27.5 ** 2)).toBeCloseTo(1, 3);
  });

  it('argola: furo e disco externo são círculos exatos', () => {
    const out = buildModel(photo, params({ style: 'rect', ringEnabled: true, ringPosX: 0, ringPosY: 1 }));
    // Argola no topo: centro em x = 27,5 e 2,5 mm acima do corpo (ver layout).
    const cx = 27.5;
    const top = Math.max(...outline(out).map(([, y]) => y));
    const cy = top - 4; // raio externo = 4
    const ring = outline(out)
      .map(([x, y]) => Math.hypot(x - cx, y - cy))
      .filter((r) => r < 4.2);
    const hole = ring.filter((r) => r < 3);
    const outer = ring.filter((r) => r >= 3 && r <= 4.2);
    expect(hole.length).toBeGreaterThan(20);
    expect(Math.max(...hole.map((r) => Math.abs(r - 2)))).toBeLessThan(0.02);
    // O disco externo se funde com o corpo; a parte livre fica no raio 4.
    const free = outer.filter((r) => r > 3.9);
    expect(free.length).toBeGreaterThan(20);
    expect(Math.max(...free.map((r) => Math.abs(r - 4)))).toBeLessThan(0.02);
  });

  it('retângulo com argola: as laterais ficam retas na largura exata', () => {
    const out = buildModel(photo, params({ style: 'rect', ringEnabled: true }));
    const xs = outline(out).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(0, 3);
    expect(Math.max(...xs)).toBeCloseTo(55, 3);
  });

  it('imagem pequena (64 px): a ampliação suave tira os blocos do contorno', () => {
    // Disco com borda antialiased, como sai de qualquer editor de imagem:
    // o alpha do pixel da borda é a fração coberta.
    const tiny = prepareSource(makeRgba(64, 64, (x, y) => {
      const cover = Math.min(1, Math.max(0, 26.5 - Math.hypot(x - 31.5, y - 31.5)));
      return [0, 0, 0, Math.round(255 * cover)];
    }));
    const spread = (surface: 'smooth' | 'pixelated') => {
      const pts = outline(buildModel(tiny, params({ style: 'contour', channel: 'alpha', captureMode: 'threshold', marginMm: 0, surface })));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const r = pts.map(([x, y]) => Math.hypot(x - cx, y - cy));
      return Math.max(...r) - Math.min(...r);
    };
    // Disco de 55 mm desenhado com pixels de ~1 mm.
    expect(spread('pixelated')).toBeGreaterThan(0.6);
    expect(spread('smooth')).toBeLessThan(0.3);
  });
});

describe('relevo suave', () => {
  const disc = prepareSource(makeRgba(N, N, (x, y) =>
    (x - 128) ** 2 + (y - 128) ** 2 <= 70 ** 2 ? BLACK : WHITE));
  const drawing = { style: 'rect', captureMode: 'threshold', invert: true } as const;

  it('threshold: a borda do desenho ganha tons intermediários (antialiasing)', () => {
    // Células com tom intermediário = borda suavizada. No pixelado só aparecem
    // quando o ponto de amostra cai a menos de 1 px da borda.
    const soft = (surface: 'smooth' | 'pixelated') =>
      buildModel(disc, params({ ...drawing, surface })).preview.data.filter((v) => v > 40 && v < 247).length;
    expect(soft('smooth')).toBeGreaterThan(2 * soft('pixelated'));
  });

  it('borda protetora suave segue o contorno e não altera o tamanho', () => {
    const plain = buildModel(disc, params({ ...drawing, style: 'circle' }));
    const out = buildModel(disc, params({ ...drawing, style: 'circle', protectiveBorder: true }));
    const { data, w, h } = out.preview;
    // Beirada do círculo (célula mais à esquerda da linha do meio) alta; miolo não.
    const mid = Math.floor(h / 2) * w;
    expect(data[mid + 1]).toBe(255);
    expect(data[mid + 12]).toBe(32);
    expect(out.stats.totalMm).toEqual(plain.stats.totalMm);
    expect(manifoldErrors(out.positions, out.indices)).toBe(0);
  });
});

describe('malha suave — invariantes', () => {
  const cases = (['contour', 'circle', 'square', 'rect'] as const).flatMap((style) => [
    { style, ringPosX: 0, ringPosY: 1 },
    { style, ringPosX: -1, ringPosY: -1 },
    { style, ringPosX: 0.35, ringPosY: -0.6 },
  ]);

  it('todos os estilos e posições de argola: fechada, orientada, sem dobras', () => {
    for (const c of cases) {
      const tag = `${c.style} ${c.ringPosX},${c.ringPosY}`;
      const out = buildModel(star, params({
        ...c, channel: 'alpha', captureMode: 'threshold', ringEnabled: true,
        protectiveBorder: true, meshResolution: 113,
      }));
      expect(manifoldErrors(out.positions, out.indices), tag).toBe(0);
      expect(flipped(out), tag).toBe(0);
      expect(signedVolume(out.positions, out.indices), tag).toBeGreaterThan(0);
      expect(minZ(out.positions), tag).toBe(0);
      expect(hasNaN(out.positions), tag).toBe(false);
    }
  });

  it('traços finos (1 a 2 células) não dobram a malha', () => {
    const lines = prepareSource(makeRgba(N, N, (x, y) => {
      const d = Math.abs(Math.hypot(x - 128, y - 128) % 22 - 11);
      return d < 1.2 || Math.abs(x - y) < 2 ? BLACK : CLEAR;
    }));
    for (const meshResolution of [80, 137, 250]) {
      const out = buildModel(lines, params({
        style: 'contour', channel: 'alpha', captureMode: 'threshold', marginMm: 0,
        minIslandMm: 0, meshResolution, ringEnabled: true,
      }));
      expect(manifoldErrors(out.positions, out.indices), String(meshResolution)).toBe(0);
      expect(flipped(out), String(meshResolution)).toBe(0);
    }
  });

  it('é determinística e o pixelado continua exatamente na grade', () => {
    const p = params({ style: 'circle', ringEnabled: true });
    const a = buildModel(photo, p);
    const b = buildModel(photo, p);
    expect(sameBytes(a.positions, b.positions)).toBe(true);
    expect(sameBytes(a.indices, b.indices)).toBe(true);

    const px = buildModel(photo, { ...p, surface: 'pixelated' });
    const s = 55 / 160; // sem argola seria exato; com argola a célula muda
    const cell = Math.max(px.stats.totalMm.w, px.stats.totalMm.h) / 160;
    expect(cell).toBeGreaterThan(s);
    for (let k = 0; k < px.positions.length; k += 3) {
      const gxi = px.positions[k] / cell;
      expect(Math.abs(gxi - Math.round(gxi))).toBeLessThan(1e-4);
    }
  });
});

describe('qualidade alta na exportação', () => {
  it('dobra a resolução da malha, até o teto de 500', () => {
    const p = params({ style: 'circle' });
    const normal = buildModel(photo, p);
    const high = buildModel(photo, p, null, 2);
    expect([normal.preview.w, high.preview.w]).toEqual([160, 320]);
    expect(high.stats.triangles / normal.stats.triangles).toBeGreaterThan(3.8);
    expect(manifoldErrors(high.positions, high.indices)).toBe(0);
    expect(flipped(high)).toBe(0);
    expect(high.stats.totalMm).toEqual(normal.stats.totalMm);

    const capped = buildModel(photo, params({ style: 'rect', meshResolution: 250 }), null, 3);
    expect(capped.preview.w).toBe(500);
  });
});

describe('campo de distância', () => {
  it('edtSquared dá a distância ao pixel ligado mais próximo', () => {
    const on = new Uint8Array(25);
    on[12] = 1; // centro de um 5x5
    const d = edtSquared(on, 5, 5);
    expect(d[12]).toBe(0);
    expect(d[0]).toBe(8);  // (2,2) de distância
    expect(d[14]).toBe(4);
  });

  it('figureSdf: negativo dentro, positivo fora, ~0 na borda', () => {
    const w = 64;
    const mask = new Uint8Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) mask[y * w + x] = Math.hypot(x - 31.5, y - 31.5) <= 20 ? 1 : 0;
    const sdf = figureSdf(mask, w, w);
    expect(sdf[32 * w + 32]).toBeLessThan(-18);
    expect(sdf[2 * w + 2]).toBeGreaterThan(18);
    // Num ponto a 10 px do centro a distância à borda é ~ -10.
    expect(sdf[32 * w + 42]).toBeCloseTo(-9.6, 0);
    // Figura que ocupa a imagem inteira: a borda da imagem conta como contorno.
    const full = figureSdf(new Uint8Array(w * w).fill(1), w, w);
    expect(full[32 * w + 32]).toBeLessThan(-30);
    expect(Math.abs(full[0])).toBeLessThan(1.5);
  });
});
