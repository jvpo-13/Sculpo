import { useState } from 'react';
import { loadFile } from '../state/actions';

const EXAMPLES = [
  { file: 'logo.png', nome: 'Logo' },
  { file: 'foto.jpg', nome: 'Foto' },
  { file: 'icone.png', nome: 'Ícone' },
];

const url = (file: string) => `${import.meta.env.BASE_URL}examples/${file}`;

async function loadExample(file: string): Promise<void> {
  const res = await fetch(url(file));
  if (!res.ok) return;
  const blob = await res.blob();
  await loadFile(new File([blob], file, { type: blob.type }));
}

/** Miniaturas de exemplo. Uma miniatura some se o arquivo não existir. */
export default function ExampleThumbs({ size = 36, rotulo = false }: { size?: number; rotulo?: boolean }) {
  const [missing, setMissing] = useState<string[]>([]);
  const visible = EXAMPLES.filter((e) => !missing.includes(e.file));
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {rotulo && <span className="text-xs text-apoio">ou experimente um exemplo:</span>}
      {visible.map((e) => (
        <button
          key={e.file}
          type="button"
          onClick={() => void loadExample(e.file)}
          title={`Exemplo: ${e.nome}`}
          aria-label={`Carregar exemplo: ${e.nome}`}
          className="overflow-hidden rounded-md border border-borda bg-fundo hover:border-destaque"
          style={{ width: size, height: size }}
        >
          <img
            src={url(e.file)}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setMissing((m) => (m.includes(e.file) ? m : [...m, e.file]))}
          />
        </button>
      ))}
    </div>
  );
}
