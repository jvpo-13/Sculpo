export interface Mesh {
  positions: Float32Array; // xyz por vértice, em mm
  indices: Uint32Array;    // 3 por triângulo, CCW visto de fora
}

/**
 * Parte 5.1: prisma sobre a grade de ocupação. Topo e fundo usam a mesma
 * grade de vértices, então as bordas coincidem por construção. Exige que a
 * ocupação não tenha "pinças" (ver fixPinches) para ser 2-manifold.
 *
 * `heightMm[c]` = altura do relevo da célula c (0 nas células livres).
 * Coordenadas: x = i*s, y = (gy-j)*s (linha 0 no topo), fundo em z = 0.
 */
export function buildMesh(
  occ: Uint8Array,
  heightMm: Float32Array,
  gx: number,
  gy: number,
  s: number,
  baseMm: number,
): Mesh {
  const vw = gx + 1;
  const vh = gy + 1;

  // 1) Vértices usados e z do topo = base + média das células ocupadas vizinhas.
  const sum = new Float64Array(vw * vh);
  const cnt = new Uint8Array(vw * vh);
  let cells = 0;
  let walls = 0;
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      if (!occ[c]) continue;
      cells++;
      const hgt = heightMm[c];
      const v00 = j * vw + i;
      sum[v00] += hgt; cnt[v00]++;
      sum[v00 + 1] += hgt; cnt[v00 + 1]++;
      sum[v00 + vw] += hgt; cnt[v00 + vw]++;
      sum[v00 + vw + 1] += hgt; cnt[v00 + vw + 1]++;
      if (i === 0 || !occ[c - 1]) walls++;
      if (i === gx - 1 || !occ[c + 1]) walls++;
      if (j === 0 || !occ[c - gx]) walls++;
      if (j === gy - 1 || !occ[c + gx]) walls++;
    }
  }

  const index = new Int32Array(vw * vh).fill(-1);
  let nTop = 0;
  for (let q = 0; q < index.length; q++) if (cnt[q] > 0) index[q] = nTop++;

  // Vértice k = topo; k + nTop = fundo (mesmo x,y, z = 0).
  const positions = new Float32Array(nTop * 2 * 3);
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      const q = j * vw + i;
      const k = index[q];
      if (k < 0) continue;
      const x = i * s;
      const y = (gy - j) * s;
      positions[k * 3] = x;
      positions[k * 3 + 1] = y;
      positions[k * 3 + 2] = baseMm + sum[q] / cnt[q];
      const kb = (k + nTop) * 3;
      positions[kb] = x;
      positions[kb + 1] = y;
      positions[kb + 2] = 0;
    }
  }

  // 2) Triângulos: 2 no topo + 2 no fundo por célula, 2 por parede.
  const indices = new Uint32Array((cells * 4 + walls * 2) * 3);
  let t = 0;
  // Parede sob a aresta A->B do contorno do topo (sentido CCW): normal para fora.
  const wall = (a: number, b: number) => {
    indices[t++] = b; indices[t++] = a; indices[t++] = a + nTop;
    indices[t++] = b; indices[t++] = a + nTop; indices[t++] = b + nTop;
  };

  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      const c = j * gx + i;
      if (!occ[c]) continue;
      // Cantos no mundo: TL/TR têm y maior (linha j), BL/BR y menor (linha j+1).
      const tl = index[j * vw + i];
      const tr = index[j * vw + i + 1];
      const bl = index[(j + 1) * vw + i];
      const br = index[(j + 1) * vw + i + 1];

      // Topo (+Z), diagonal fixa BL-TR.
      indices[t++] = bl; indices[t++] = br; indices[t++] = tr;
      indices[t++] = bl; indices[t++] = tr; indices[t++] = tl;
      // Fundo (-Z): mesma diagonal, orientação invertida.
      indices[t++] = bl + nTop; indices[t++] = tr + nTop; indices[t++] = br + nTop;
      indices[t++] = bl + nTop; indices[t++] = tl + nTop; indices[t++] = tr + nTop;

      if (j === gy - 1 || !occ[c + gx]) wall(bl, br); // lado de baixo (-Y)
      if (i === gx - 1 || !occ[c + 1]) wall(br, tr);  // direita (+X)
      if (j === 0 || !occ[c - gx]) wall(tr, tl);      // lado de cima (+Y)
      if (i === 0 || !occ[c - 1]) wall(tl, bl);       // esquerda (-X)
    }
  }

  return { positions, indices };
}
