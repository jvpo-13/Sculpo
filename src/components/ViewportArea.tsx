import { useEffect, useRef, useState, type DragEvent } from 'react';
import { loadFile } from '../state/actions';
import { WARNING_TEXT } from '../state/filaments';
import { useStore } from '../state/store';
import Viewport from '../three/Viewport';
import ExampleThumbs from './ExampleThumbs';
import FilamentPicker from './FilamentPicker';

const BUSY_DELAY_MS = 150;

// Só vira true se `busy` durar mais que o atraso: builds rápidos não piscam.
function useDelayed(busy: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!busy) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(t);
  }, [busy, ms]);
  return shown;
}

// Faixa do topo: erros, avisos e o indicador de processamento, empilhados.
function Banner({ busy }: { busy: boolean }) {
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  const warnings = useStore((s) => s.warnings);
  const key = warnings.join(',');
  const [dismissed, setDismissed] = useState('');

  const showWarnings = warnings.length > 0 && dismissed !== key;
  if (!error && !showWarnings && !busy) return null;

  return (
    <div className="absolute inset-x-3 top-3 z-20 flex flex-col gap-2">
      {busy && (
        <div role="status" className="flex items-center gap-2 self-end rounded-full border border-borda bg-painel px-3 py-1.5 text-xs text-apoio">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-borda border-t-destaque" aria-hidden="true" />
          Processando…
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-destaque bg-[#3a201b] px-4 py-2 text-sm">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dispensar erro" className="px-1 text-lg leading-none text-apoio hover:text-texto">
            ×
          </button>
        </div>
      )}
      {showWarnings && (
        <div role="status" className="flex items-start gap-3 rounded-md border border-borda bg-painel px-4 py-2 text-sm text-apoio">
          <div className="flex-1">
            {warnings.map((w) => (
              <p key={w}>{WARNING_TEXT[w]}</p>
            ))}
          </div>
          <button type="button" onClick={() => setDismissed(key)} aria-label="Dispensar aviso" className="px-1 text-lg leading-none hover:text-texto">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ dragging }: { dragging: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-fundo p-6">
      <div
        className={
          'flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors ' +
          (dragging ? 'border-destaque bg-destaque/10' : 'border-borda')
        }
      >
        <svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#9AA1AD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="10" width="36" height="28" rx="4" />
          <circle cx="17" cy="20" r="3" />
          <path d="M6 32l10-8 8 6 7-5 11 9" />
        </svg>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void loadFile(file);
          }}
        />
        <button type="button" onClick={() => input.current?.click()} className="rounded-md px-2 py-1 text-lg font-medium hover:text-destaque">
          Arraste uma imagem aqui ou clique em Carregar Imagem
        </button>
        <p className="text-sm text-apoio">PNG, JPEG ou WebP, até 8 MB.</p>
        <ExampleThumbs size={64} rotulo />
      </div>
    </div>
  );
}

/** Área central: viewport 3D, estado vazio, arrastar-e-soltar e feedback. */
export default function ViewportArea() {
  const hasImage = useStore((s) => s.image !== null);
  const hasModel = useStore((s) => s.result !== null);
  const busy = useDelayed(useStore((s) => s.busy), BUSY_DELAY_MS);
  const [dragging, setDragging] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void loadFile(file);
  };

  return (
    <div
      className="absolute inset-0"
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <Viewport resetSignal={resetSignal} />

      {!hasImage && <EmptyState dragging={dragging} />}
      {hasImage && dragging && (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-destaque bg-fundo/70 text-lg font-medium">
          Solte para trocar a imagem
        </div>
      )}

      <Banner busy={busy} />

      {hasImage && hasModel && (
        <>
          <div className="absolute bottom-3 left-3 z-10">
            <FilamentPicker />
          </div>
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            className="absolute bottom-3 right-3 z-10 rounded-md border border-borda bg-painel/90 px-3 py-2 text-sm font-medium hover:border-apoio"
          >
            Resetar câmera
          </button>
        </>
      )}
    </div>
  );
}
