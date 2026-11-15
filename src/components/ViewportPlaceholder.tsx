// Placeholder do viewport. O Three.js entra no Marco 4 (src/three/Viewport.tsx).
export default function ViewportPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border-2 border-dashed border-borda px-8 py-12 text-center">
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#9AA1AD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="10" width="36" height="28" rx="4" />
          <circle cx="17" cy="20" r="3" />
          <path d="M6 32l10-8 8 6 7-5 11 9" />
        </svg>
        <p className="text-base font-medium">
          Arraste uma imagem aqui ou clique em Carregar Imagem
        </p>
        <p className="text-sm text-apoio">PNG, JPEG ou WebP, até 8 MB.</p>
      </div>
    </div>
  );
}
