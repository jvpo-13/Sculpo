// Operações binárias em grades (máscaras Uint8, 0 = livre, != 0 = ocupado).
// Fora da grade conta sempre como livre.

/** Dilatação 3x3: cruz (4 vizinhos) ou quadrado (8 vizinhos). */
export function dilate(src: Uint8Array, w: number, h: number, square: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let on =
        src[p] !== 0 ||
        (x > 0 && src[p - 1] !== 0) ||
        (x < w - 1 && src[p + 1] !== 0) ||
        (y > 0 && src[p - w] !== 0) ||
        (y < h - 1 && src[p + w] !== 0);
      if (!on && square) {
        on =
          (x > 0 && y > 0 && src[p - w - 1] !== 0) ||
          (x < w - 1 && y > 0 && src[p - w + 1] !== 0) ||
          (x > 0 && y < h - 1 && src[p + w - 1] !== 0) ||
          (x < w - 1 && y < h - 1 && src[p + w + 1] !== 0);
      }
      out[p] = on ? 1 : 0;
    }
  }
  return out;
}

/** Erosão 3x3: cruz ou quadrado. Células na borda da grade sempre caem. */
export function erode(src: Uint8Array, w: number, h: number, square: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      let on =
        src[p] !== 0 && src[p - 1] !== 0 && src[p + 1] !== 0 && src[p - w] !== 0 && src[p + w] !== 0;
      if (on && square) {
        on =
          src[p - w - 1] !== 0 && src[p - w + 1] !== 0 && src[p + w - 1] !== 0 && src[p + w + 1] !== 0;
      }
      out[p] = on ? 1 : 0;
    }
  }
  return out;
}

/** n passos alternando cruz e quadrado (aproxima um disco). */
export function dilateRound(src: Uint8Array, w: number, h: number, steps: number): Uint8Array {
  let cur = src;
  for (let k = 0; k < steps; k++) cur = dilate(cur, w, h, k % 2 === 1);
  return cur;
}

export function erodeRound(src: Uint8Array, w: number, h: number, steps: number): Uint8Array {
  let cur = src;
  for (let k = 0; k < steps; k++) cur = erode(cur, w, h, k % 2 === 1);
  return cur;
}

/**
 * Preenche buracos no lugar: toda célula livre que não alcança a borda da
 * grade (4-vizinhança) vira `fill`.
 */
export function fillHoles(mask: Uint8Array, w: number, h: number, fill = 1): void {
  const n = w * h;
  const outside = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const push = (p: number) => {
    if (mask[p] === 0 && outside[p] === 0) {
      outside[p] = 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  for (let p = 0; p < n; p++) if (mask[p] === 0 && outside[p] === 0) mask[p] = fill;
}

export interface Components {
  labels: Int32Array; // 0 = livre, 1..n = componente
  sizes: number[];    // sizes[k] = células do componente k+1
}

/** Componentes conexos em 4-vizinhança, rotulados em ordem de varredura. */
export function labelComponents(mask: ArrayLike<number>, w: number, h: number): Components {
  const n = w * h;
  const labels = new Int32Array(n);
  const sizes: number[] = [];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (!mask[start] || labels[start] !== 0) continue;
    const id = sizes.length + 1;
    let size = 0;
    let top = 0;
    labels[start] = id;
    stack[top++] = start;
    while (top > 0) {
      const p = stack[--top];
      size++;
      const x = p % w;
      if (x > 0 && mask[p - 1] && labels[p - 1] === 0) { labels[p - 1] = id; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && labels[p + 1] === 0) { labels[p + 1] = id; stack[top++] = p + 1; }
      if (p >= w && mask[p - w] && labels[p - w] === 0) { labels[p - w] = id; stack[top++] = p - w; }
      if (p < n - w && mask[p + w] && labels[p + w] === 0) { labels[p + w] = id; stack[top++] = p + w; }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}
