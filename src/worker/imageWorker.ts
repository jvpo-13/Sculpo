// Casca fina do Web Worker: decodifica, chama o core e transfere buffers.
// Todo o algoritmo mora em src/core.
import { BlankError } from '../core/mask';
import { buildModel, prepareSource, type Source, type TonalCache } from '../core/pipeline';
import { buildSTL } from '../core/stl';
import type { AdvancedParams, ErrorCode, FromWorker, ToWorker } from '../types';

// A lib DOM não declara o escopo do worker; isto é o mínimo que usamos
// (sem misturar a lib WebWorker no tsconfig).
interface DedicatedWorkerGlobalScope {
  onmessage: ((ev: MessageEvent<ToWorker>) => void) | null;
  postMessage(message: FromWorker, transfer?: Transferable[]): void;
}
const ctx = self as unknown as DedicatedWorkerGlobalScope;

const MAX_SOURCE_SIDE = 1024;
const MSG_BLANK = 'Não detectamos um desenho nesta imagem.';
const MSG_DECODE = 'Não foi possível ler esta imagem.';
const MSG_NO_IMAGE = 'Carregue uma imagem primeiro.';

// Estado do worker: a ÚNICA cópia da imagem e o cache do Estágio B.
let source: Source | null = null;
let cache: TonalCache | null = null;

function fail(id: number, code: ErrorCode, message: string): void {
  ctx.postMessage({ type: 'error', id, code, message });
}

async function load(id: number, blob: Blob): Promise<void> {
  source = null;
  cache = null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, {
      imageOrientation: 'from-image',
      premultiplyAlpha: 'none',
    });
  } catch {
    fail(id, 'decode', MSG_DECODE);
    return;
  }

  const { width, height } = bitmap;
  // Reduz para no máximo 1024 no maior lado já no desenho (uma decodificação só).
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) {
    bitmap.close();
    fail(id, 'unsupported', 'Seu navegador é antigo demais. Atualize para usar o Sculpo.');
    return;
  }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const pixels = g.getImageData(0, 0, w, h);

  const prepared = prepareSource({ data: pixels.data, width: w, height: h });
  if (prepared.detected.blank) {
    fail(id, 'blank', MSG_BLANK);
    return;
  }
  source = prepared;
  ctx.postMessage({ type: 'loaded', id, width, height, detected: prepared.detected });
}

// `scale` > 0 = exportação (1 = normal, 2 = alta); 0 = build do preview.
function run(id: number, params: AdvancedParams, scale: number): void {
  const exportStl = scale > 0;
  if (!source) {
    fail(id, 'decode', MSG_NO_IMAGE);
    return;
  }
  const t0 = performance.now();
  try {
    const out = buildModel(source, params, cache, exportStl ? scale : 1);
    cache = out.cache;
    if (exportStl) {
      const buffer = buildSTL(out.positions, out.indices);
      ctx.postMessage({ type: 'stl', id, buffer, triangles: out.stats.triangles }, [buffer]);
      return;
    }
    ctx.postMessage(
      {
        type: 'built',
        id,
        preview: out.preview,
        mesh: { positions: out.positions, indices: out.indices },
        stats: { ...out.stats, ms: Math.round(performance.now() - t0) },
      },
      [out.preview.data.buffer, out.positions.buffer, out.indices.buffer],
    );
  } catch (err) {
    if (err instanceof BlankError) fail(id, 'blank', MSG_BLANK);
    else fail(id, 'decode', 'Não foi possível gerar o modelo.');
  }
}

ctx.onmessage = (ev) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'load':
      void load(msg.id, msg.blob);
      break;
    case 'build':
      run(msg.id, msg.params, 0);
      break;
    case 'exportStl':
      run(msg.id, msg.params, msg.quality === 'high' ? 2 : 1);
      break;
  }
};
