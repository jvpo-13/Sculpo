import { useRef } from 'react';
import { downloadStl, loadFile } from '../state/actions';
import { useStore, type Mode } from '../state/store';
import ExampleThumbs from './ExampleThumbs';

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="2" y="8" width="24" height="18" rx="5" fill="#E06D53" />
        <circle cx="14" cy="6" r="4" fill="none" stroke="#E06D53" strokeWidth="2.5" />
        <path d="M9 19c2 2.5 8 2.5 10 0M10 14h2M16 14h2" stroke="#0F1115" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">Sculpo</span>
    </div>
  );
}

const MODOS: { id: Mode; rotulo: string }[] = [
  { id: 'basic', rotulo: 'Modo Básico' },
  { id: 'advanced', rotulo: 'Modo Avançado' },
];

export default function Header() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const temMalha = useStore((s) => s.result !== null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b border-borda bg-painel px-4 py-2">
      <Logo />

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Limpa o valor para permitir recarregar o mesmo arquivo.
          e.target.value = '';
          if (file) void loadFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="rounded-md border border-borda px-3 py-2 text-sm font-medium text-texto hover:border-apoio"
      >
        Carregar Imagem
      </button>
      <ExampleThumbs />

      <div
        role="radiogroup"
        aria-label="Modo de edição"
        className="ml-auto flex rounded-md border border-borda bg-fundo p-0.5"
      >
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            // Padrão de radiogroup: só o selecionado entra no Tab; setas trocam.
            tabIndex={mode === m.id ? 0 : -1}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
              e.preventDefault();
              const other = m.id === 'basic' ? 'advanced' : 'basic';
              setMode(other);
              const group = e.currentTarget.parentElement;
              requestAnimationFrame(() =>
                group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(),
              );
            }}
            onClick={() => setMode(m.id)}
            className={
              'rounded px-3 py-1.5 text-sm font-medium transition-colors ' +
              (mode === m.id ? 'bg-destaque text-fundo' : 'text-apoio hover:text-texto')
            }
          >
            {m.rotulo}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!temMalha}
        onClick={() => void downloadStl()}
        className="rounded-md bg-destaque px-4 py-2 text-sm font-semibold text-fundo disabled:cursor-not-allowed disabled:opacity-40"
      >
        Baixar Chaveiro (.STL)
      </button>
    </header>
  );
}
