import { useStore } from '../state/store';
import PreviewCanvas from './PreviewCanvas';

// Placeholder do viewport. O Three.js entra no Marco 4 (src/three/Viewport.tsx);
// até lá mostra o estado do pipeline e a prévia 2D do relevo.
export default function ViewportPlaceholder() {
  const image = useStore((s) => s.image);
  const result = useStore((s) => s.result);
  const busy = useStore((s) => s.busy);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6">
      {error && (
        <div role="alert" className="flex max-w-md items-start gap-3 rounded-md border border-destaque/60 bg-destaque/10 px-4 py-2 text-sm">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dispensar erro" className="px-1 text-apoio hover:text-texto">
            ×
          </button>
        </div>
      )}

      {!image ? (
        <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-dashed border-borda px-8 py-12 text-center">
          <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#9AA1AD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="10" width="36" height="28" rx="4" />
            <circle cx="17" cy="20" r="3" />
            <path d="M6 32l10-8 8 6 7-5 11 9" />
          </svg>
          <p className="text-base font-medium">
            {busy ? 'Processando…' : 'Arraste uma imagem aqui ou clique em Carregar Imagem'}
          </p>
          <p className="text-sm text-apoio">PNG, JPEG ou WebP, até 8 MB.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <PreviewCanvas />
          <p className="text-sm font-medium">{image.name}</p>
          <p className="text-xs text-apoio" aria-live="polite">
            {busy && !result && 'Processando…'}
            {result &&
              `${Math.round(result.stats.totalMm.w)} x ${Math.round(result.stats.totalMm.h)} mm · ` +
                `${result.stats.triangles.toLocaleString('pt-BR')} triângulos` +
                (busy ? ' · atualizando…' : '')}
          </p>
        </div>
      )}
    </div>
  );
}
