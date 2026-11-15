const HEADER = 'Sculpo STL binary';

/** Parte 5.3: STL binário, little-endian, unidade mm. */
export function buildSTL(positions: Float32Array, indices: Uint32Array): ArrayBuffer {
  const triangles = Math.floor(indices.length / 3);
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Header de 80 bytes; o resto já está zerado.
  for (let k = 0; k < HEADER.length; k++) bytes[k] = HEADER.charCodeAt(k);
  view.setUint32(80, triangles, true);

  let o = 84;
  for (let t = 0; t < triangles; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];

    // Normal = (B-A) x (C-A) normalizada; degenerado vira (0,0,1).
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      nx /= len; ny /= len; nz /= len;
    } else {
      nx = 0; ny = 0; nz = 1;
    }

    view.setFloat32(o, nx, true);
    view.setFloat32(o + 4, ny, true);
    view.setFloat32(o + 8, nz, true);
    view.setFloat32(o + 12, ax, true);
    view.setFloat32(o + 16, ay, true);
    view.setFloat32(o + 20, az, true);
    view.setFloat32(o + 24, bx, true);
    view.setFloat32(o + 28, by, true);
    view.setFloat32(o + 32, bz, true);
    view.setFloat32(o + 36, cx, true);
    view.setFloat32(o + 40, cy, true);
    view.setFloat32(o + 44, cz, true);
    view.setUint16(o + 48, 0, true);
    o += 50;
  }
  return buffer;
}
