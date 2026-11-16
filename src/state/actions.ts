import { HEADER_BYTES, MSG_OLD_BROWSER, validateFile } from '../core/validate';
import { getClient } from '../worker/client';
import { WorkerError } from '../worker/workerClient';
import { effectiveParams, useStore, type SculpoState } from './store';

const MSG_UNKNOWN = 'Algo deu errado. Tente novamente.';
const ADVANCED_DEBOUNCE_MS = 50;

function messageOf(err: unknown): string {
  return err instanceof WorkerError ? err.message : MSG_UNKNOWN;
}

function browserSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
  );
}

/** Valida (3.1) e carrega um arquivo. O build dispara sozinho pela assinatura do store. */
export async function loadFile(file: File): Promise<void> {
  const store = useStore.getState();
  store.setError(null);

  if (!browserSupported()) {
    store.setError(MSG_OLD_BROWSER);
    return;
  }
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const problem = validateFile(file.type, file.size, head);
  if (problem) {
    store.setError(problem);
    return;
  }

  store.setBusy(true);
  try {
    const loaded = await getClient().load(file);
    if (!loaded) return; // superado por outro carregamento
    useStore
      .getState()
      .setImage(file, { name: file.name, width: loaded.width, height: loaded.height }, loaded.detected);
  } catch (err) {
    const s = useStore.getState();
    s.clearImage();
    s.setError(messageOf(err));
    s.setBusy(false);
  }
}

/** Reconstrói o modelo com os parâmetros efetivos atuais. */
export async function rebuild(): Promise<void> {
  const store = useStore.getState();
  if (!store.image) return;
  store.setBusy(true);
  try {
    const built = await getClient().build(effectiveParams(store));
    if (!built) return; // superado por um build mais novo, que cuida do `busy`
    const s = useStore.getState();
    s.setResult({ preview: built.preview, mesh: built.mesh, stats: built.stats });
    s.setBusy(false);
  } catch (err) {
    const s = useStore.getState();
    if (err instanceof WorkerError && err.code === 'blank') s.setResult(null);
    s.setError(messageOf(err));
    s.setBusy(false);
  }
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Parte 5.4: o worker refaz o build (determinístico) e devolve o STL. */
export async function downloadStl(): Promise<void> {
  const store = useStore.getState();
  if (!store.image || !store.result) return;
  store.setExporting(true);
  try {
    const stl = await getClient().exportStl(effectiveParams(store), store.exportQuality);
    if (!stl) return;
    const url = URL.createObjectURL(new Blob([stl.buffer], { type: 'model/stl' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sculpo-${stamp(new Date())}.stl`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    useStore.getState().setError(messageOf(err));
  } finally {
    useStore.getState().setExporting(false);
  }
}

function paramsChanged(s: SculpoState, prev: SculpoState): boolean {
  if (s.image !== prev.image || s.mode !== prev.mode) return true;
  return s.mode === 'basic'
    ? s.basic !== prev.basic || s.detected !== prev.detected
    : s.advanced !== prev.advanced;
}

/** Liga o store ao worker: qualquer mudança nos parâmetros efetivos refaz o build. */
export function startAutoRebuild(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const unsubscribe = useStore.subscribe((s, prev) => {
    if (!s.image || !paramsChanged(s, prev)) return;
    cancel();
    // Controles do Modo Avançado (sliders) disparam em rajada: espera 50 ms.
    const tweak = s.mode === 'advanced' && prev.mode === 'advanced' && s.image === prev.image;
    if (!tweak) {
      void rebuild();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void rebuild();
    }, ADVANCED_DEBOUNCE_MS);
  });
  return () => {
    cancel();
    unsubscribe();
  };
}
