import { FILAMENTS } from '../state/filaments';
import { useStore } from '../state/store';
import type { FilamentColor } from '../types';

function Row({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: FilamentColor;
  onChange: (c: FilamentColor) => void;
}) {
  return (
    <div role="radiogroup" aria-label={`Cor do filamento: ${rotulo}`} className="flex items-center gap-2">
      <span className="w-12 text-xs text-apoio">{rotulo}</span>
      {FILAMENTS.map((f) => (
        <label key={f.id} className="relative cursor-pointer" title={f.nome}>
          <input
            type="radio"
            name={`filamento-${rotulo}`}
            className="peer sr-only"
            checked={valor === f.id}
            onChange={() => onChange(f.id)}
            aria-label={`${rotulo}: ${f.nome}`}
          />
          <span
            className="block h-6 w-6 rounded-full border border-borda ring-offset-2 ring-offset-painel peer-checked:ring-2 peer-checked:ring-texto peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-destaque"
            style={{ backgroundColor: f.hex }}
          />
        </label>
      ))}
    </div>
  );
}

/** Seletor de filamento: muda só as cores do preview, nunca o STL. */
export default function FilamentPicker() {
  const baseColor = useStore((s) => s.baseColor);
  const reliefColor = useStore((s) => s.reliefColor);
  const setColors = useStore((s) => s.setColors);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-borda bg-painel/90 p-3">
      <Row rotulo="Base" valor={baseColor} onChange={(c) => setColors({ baseColor: c })} />
      <Row rotulo="Relevo" valor={reliefColor} onChange={(c) => setColors({ reliefColor: c })} />
    </div>
  );
}
