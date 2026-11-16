import type { Field } from './field';
import type { Mesh } from './mesh';

// A interseção nunca encosta num nó: evita arestas de comprimento zero.
const T_MIN = 0.02;
// Valor usado quando a ocupação e o campo discordam (célula criada pela
// correção de pinças, buraco preenchido, ilha removida): 1/4 de célula.
const FORCED = 0.25;

/**
 * Malha com contorno liso (acabamento suave).
 *
 * Os NÓS são os centros das células; cada quadrado entre 4 nós vizinhos é
 * recortado pela curva real do contorno (marching squares): o ponto de corte
 * em cada aresta sai da interpolação do campo de distância. Assim a parede
 * acompanha círculos e curvas em vez de andar em degraus.
 *
 * Mesmos invariantes da malha em grade: fechada, 2-manifold, orientada,
 * fundo em z = 0. Não há como um triângulo dobrar, pois cada polígono
 * recortado é convexo por construção.
 */
export function buildSmoothMesh(
  occ: Uint8Array,
  heightMm: Float32Array,
  field: Field,
  gx: number,
  gy: number,
  s: number,
  baseMm: number,
): Mesh {
  // Grade de nós com 1 anel livre em volta, para o contorno poder passar
  // além do centro das células da beirada.
  const pw = gx + 2;
  const ph = gy + 2;
  const on = new Uint8Array(pw * ph);
  const f = new Float64Array(pw * ph);
  const hgt = new Float32Array(pw * ph);
  for (let J = 0; J < ph; J++) {
    for (let I = 0; I < pw; I++) {
      const i = I - 1;
      const j = J - 1;
      const q = J * pw + I;
      const inside = i >= 0 && j >= 0 && i < gx && j < gy;
      const solid = inside && occ[j * gx + i] !== 0;
      const value = field((i + 0.5) * s, (j + 0.5) * s);
      if (solid) {
        on[q] = 1;
        hgt[q] = heightMm[j * gx + i];
        f[q] = value > 0 ? value : FORCED * s;
      } else {
        f[q] = value < 0 ? value : -FORCED * s;
      }
    }
  }

  // Vértices: um por nó ocupado e um por aresta que cruza o contorno.
  const nodeIdx = new Int32Array(pw * ph).fill(-1);
  const hIdx = new Int32Array(pw * ph).fill(-1); // aresta (I,J)-(I+1,J)
  const vIdx = new Int32Array(pw * ph).fill(-1); // aresta (I,J)-(I,J+1)
  let nTop = 0;
  for (let q = 0; q < on.length; q++) if (on[q]) nodeIdx[q] = nTop++;
  for (let J = 0; J < ph; J++) {
    for (let I = 0; I < pw; I++) {
      const q = J * pw + I;
      if (I < pw - 1 && on[q] !== on[q + 1]) hIdx[q] = nTop++;
      if (J < ph - 1 && on[q] !== on[q + pw]) vIdx[q] = nTop++;
    }
  }

  const positions = new Float32Array(nTop * 2 * 3);
  const put = (k: number, u: number, v: number, z: number) => {
    // v cresce para baixo na grade; y cresce para cima no mundo.
    const x = u;
    const y = gy * s - v;
    positions[k * 3] = x;
    positions[k * 3 + 1] = y;
    positions[k * 3 + 2] = z;
    const kb = (k + nTop) * 3;
    positions[kb] = x;
    positions[kb + 1] = y;
    positions[kb + 2] = 0;
  };
  // Fração do caminho A->B onde o campo cruza zero.
  const cut = (a: number, b: number) => {
    const t = f[a] / (f[a] - f[b]);
    return t < T_MIN ? T_MIN : t > 1 - T_MIN ? 1 - T_MIN : t;
  };
  for (let J = 0; J < ph; J++) {
    for (let I = 0; I < pw; I++) {
      const q = J * pw + I;
      const u = (I - 0.5) * s;
      const v = (J - 0.5) * s;
      if (nodeIdx[q] >= 0) put(nodeIdx[q], u, v, baseMm + hgt[q]);
      // A altura do ponto de corte é a do nó ocupado da aresta.
      if (hIdx[q] >= 0) put(hIdx[q], u + cut(q, q + 1) * s, v, baseMm + (on[q] ? hgt[q] : hgt[q + 1]));
      if (vIdx[q] >= 0) put(vIdx[q], u, v + cut(q, q + pw) * s, baseMm + (on[q] ? hgt[q] : hgt[q + pw]));
    }
  }

  // Polígono de cada quadrado, em sentido anti-horário no mundo:
  // BL -> BR -> TR -> TL, intercalando os pontos de corte.
  const poly = new Int32Array(8);
  const isCut = new Uint8Array(8);
  const walk = (I: number, J: number): number => {
    const tl = J * pw + I;
    const tr = tl + 1;
    const bl = tl + pw;
    const br = bl + 1;
    let m = 0;
    const corner = (q: number) => {
      if (on[q]) { poly[m] = nodeIdx[q]; isCut[m++] = 0; }
    };
    const edge = (id: number) => {
      if (id >= 0) { poly[m] = id; isCut[m++] = 1; }
    };
    corner(bl); edge(hIdx[bl]);
    corner(br); edge(vIdx[tr]);
    corner(tr); edge(hIdx[tl]);
    corner(tl); edge(vIdx[tl]);
    return m;
  };

  // 1ª passada: conta os triângulos. m vértices -> (m-2) no topo e no fundo;
  // cada par de cortes consecutivos é um trecho de parede (2 triângulos).
  let triangles = 0;
  for (let J = 0; J < ph - 1; J++) {
    for (let I = 0; I < pw - 1; I++) {
      const m = walk(I, J);
      if (m < 3) continue;
      let cuts = 0;
      for (let k = 0; k < m; k++) cuts += isCut[k];
      triangles += 2 * (m - 2) + cuts;
    }
  }

  const indices = new Uint32Array(triangles * 3);
  let t = 0;
  const tri = (a: number, b: number, c: number) => {
    indices[t++] = a; indices[t++] = b; indices[t++] = c;
    indices[t++] = a + nTop; indices[t++] = c + nTop; indices[t++] = b + nTop; // fundo invertido
  };
  for (let J = 0; J < ph - 1; J++) {
    for (let I = 0; I < pw - 1; I++) {
      const m = walk(I, J);
      if (m < 3) continue;

      if (m === 4 && isCut[0] + isCut[1] + isCut[2] + isCut[3] === 0) {
        // Quadrado inteiro: a diagonal liga os dois cantos de altura mais
        // parecida (evita dente de serra nas rampas).
        const zBL = positions[poly[0] * 3 + 2], zBR = positions[poly[1] * 3 + 2];
        const zTR = positions[poly[2] * 3 + 2], zTL = positions[poly[3] * 3 + 2];
        if (Math.abs(zBR - zTL) < Math.abs(zBL - zTR)) {
          tri(poly[1], poly[2], poly[3]);
          tri(poly[1], poly[3], poly[0]);
        } else {
          tri(poly[0], poly[1], poly[2]);
          tri(poly[0], poly[2], poly[3]);
        }
        continue;
      }

      for (let k = 1; k < m - 1; k++) tri(poly[0], poly[k], poly[k + 1]);
      // Parede sob cada trecho do contorno (corte -> corte), normal para fora.
      for (let k = 0; k < m; k++) {
        const n = (k + 1) % m;
        if (!isCut[k] || !isCut[n]) continue;
        const a = poly[k];
        const b = poly[n];
        indices[t++] = b; indices[t++] = a; indices[t++] = a + nTop;
        indices[t++] = b; indices[t++] = a + nTop; indices[t++] = b + nTop;
      }
    }
  }

  return { positions, indices };
}
