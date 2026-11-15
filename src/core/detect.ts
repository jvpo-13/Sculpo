import type { Detected } from '../types';
import type { Rgba } from './resample';

/**
 * Auto-detecção determinística (3.2 e 3.4), sobre a imagem composta sobre
 * branco. Uma única passada pelos pixels.
 */
export function detect(src: Rgba): Detected {
  const { data, width, height } = src;
  const n = width * height;

  let sumL = 0, sumL2 = 0, sumA = 0, sumA2 = 0;
  let bright = 0;       // luma > 240
  let transparent = 0;  // alpha < 128
  let notOpaque = 0;    // alpha < 250

  for (let p = 0, q = 0; p < n; p++, q += 4) {
    const a8 = data[q + 3];
    const a = a8 / 255;
    const white = 255 * (1 - a);
    const luma =
      0.2126 * (data[q] * a + white) +
      0.7152 * (data[q + 1] * a + white) +
      0.0722 * (data[q + 2] * a + white);
    sumL += luma;
    sumL2 += luma * luma;
    sumA += a8;
    sumA2 += a8 * a8;
    if (luma > 240) bright++;
    if (a8 < 128) transparent++;
    if (a8 < 250) notOpaque++;
  }

  const count = Math.max(1, n);
  const mean = sumL / count;
  const lumaStdDev = Math.sqrt(Math.max(0, sumL2 / count - mean * mean));
  const meanA = sumA / count;
  const alphaStdDev = Math.sqrt(Math.max(0, sumA2 / count - meanA * meanA));

  const blank = lumaStdDev < 2 && alphaStdDev < 2;
  const lowContrast = !blank && lumaStdDev < 30 && alphaStdDev < 30;
  const hasAlpha = notOpaque / count > 0.01;

  const base = { hasAlpha, lumaStdDev, blank, lowContrast };

  // A regra de alpha vem primeiro: transparência composta sobre branco
  // pareceria "fundo claro".
  if (transparent / count > 0.3) {
    return { ...base, channel: 'alpha', captureMode: 'threshold', threshold: 128, invert: false };
  }
  if (bright / count > 0.6 && mean > 180) {
    return { ...base, channel: 'luma', captureMode: 'threshold', threshold: 128, invert: true };
  }
  return { ...base, channel: 'luma', captureMode: 'continuous', threshold: 128, invert: false };
}
