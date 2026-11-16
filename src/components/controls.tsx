import type { ReactNode } from 'react';

// Controles do Modo Avançado. Todos têm <label> associado e aria-label.

export function Section({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-borda p-3">
      <h2 className="mb-3 text-sm font-semibold">{titulo}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Slider({
  id,
  rotulo,
  min,
  max,
  step,
  valor,
  onChange,
  formato = (v) => String(v),
  disabled = false,
}: {
  id: string;
  rotulo: string;
  min: number;
  max: number;
  step: number;
  valor: number;
  onChange: (v: number) => void;
  formato?: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-apoio">
          {rotulo}
        </label>
        <output htmlFor={id} className="text-xs tabular-nums">
          {formato(valor)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        aria-label={rotulo}
        aria-valuetext={formato(valor)}
        min={min}
        max={max}
        step={step}
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-5 w-full cursor-pointer accent-destaque disabled:cursor-not-allowed"
      />
    </div>
  );
}

export function Select<T extends string>({
  id,
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: T;
  opcoes: { id: T; rotulo: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs text-apoio">
        {rotulo}
      </label>
      <select
        id={id}
        aria-label={rotulo}
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        className="min-w-0 rounded-md border border-borda bg-fundo px-2 py-1.5 text-xs text-texto"
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toggle({
  id,
  rotulo,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="cursor-pointer text-xs text-apoio">
        {rotulo}
      </label>
      <span className="relative inline-flex h-5 w-9 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-label={rotulo}
          checked={valor}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <span className="h-full w-full rounded-full bg-borda transition-colors peer-checked:bg-destaque peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-destaque" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-texto transition-transform peer-checked:translate-x-4" />
      </span>
    </div>
  );
}

/** Grupo de radios nativos em linha (as setas do teclado funcionam sozinhas). */
export function RadioRow<T extends string>({
  nome,
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  nome: string;
  rotulo: string;
  valor: T;
  opcoes: { id: T; rotulo: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs text-apoio">{rotulo}</legend>
      <div className="flex rounded-md border border-borda bg-fundo p-0.5">
        {opcoes.map((o) => (
          <label key={o.id} className="relative flex-1 cursor-pointer">
            <input
              type="radio"
              name={nome}
              className="peer sr-only"
              checked={valor === o.id}
              onChange={() => onChange(o.id)}
            />
            <span className="block rounded px-2 py-1.5 text-center text-xs font-medium text-apoio peer-checked:bg-destaque peer-checked:text-fundo peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-destaque">
              {o.rotulo}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
