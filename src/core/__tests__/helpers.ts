import { DEFAULT_DETECTED, deriveAdvanced } from '../derive';
import type { Rgba } from '../resample';
import type { AdvancedParams } from '../../types';

type Pixel = [number, number, number, number];

/** Imagem sintética: fn(x, y) devolve [r, g, b, a] em 0..255. */
export function makeRgba(width: number, height: number, fn: (x: number, y: number) => Pixel): Rgba {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = fn(x, y);
      data.set(px, (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

export const WHITE: Pixel = [255, 255, 255, 255];
export const BLACK: Pixel = [0, 0, 0, 255];
export const CLEAR: Pixel = [0, 0, 0, 0];

/** Parâmetros padrão do modo básico, com sobrescritas. */
export function params(patch: Partial<AdvancedParams> = {}): AdvancedParams {
  const base = deriveAdvanced(
    { style: 'rect', size: 'M', reliefType: 'raised', ringPosition: 'none' },
    DEFAULT_DETECTED,
  );
  return { ...base, ...patch };
}

/** Invariante 5.2a: cada aresta orientada aparece 1 vez e a reversa também. */
export function manifoldErrors(positions: Float32Array, indices: Uint32Array): number {
  const n = positions.length / 3;
  const edges = new Map<number, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k];
      const b = indices[t + ((k + 1) % 3)];
      const key = a * n + b;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let errors = 0;
  for (const [key, count] of edges) {
    const a = Math.floor(key / n);
    const b = key % n;
    if (count !== 1 || edges.get(b * n + a) !== 1) errors++;
  }
  return errors;
}

/** Volume com sinal (positivo se as normais apontam para fora). */
export function signedVolume(positions: Float32Array, indices: Uint32Array): number {
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}

export function minZ(positions: Float32Array): number {
  let m = Infinity;
  for (let k = 2; k < positions.length; k += 3) if (positions[k] < m) m = positions[k];
  return m;
}

export function hasNaN(values: Float32Array): boolean {
  for (let k = 0; k < values.length; k++) if (Number.isNaN(values[k])) return true;
  return false;
}

export function sameBytes(a: ArrayBufferView, b: ArrayBufferView): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return false;
  return true;
}
