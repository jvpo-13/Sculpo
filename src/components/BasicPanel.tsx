import type { ReactNode } from 'react';
import { WARNING_TEXT } from '../state/filaments';
import { useStore } from '../state/store';
import type { ReliefType, RingPosition, ShapeStyle, SizePreset } from '../types';

interface Option<T extends string> {
  id: T;
  rotulo: string;
  detalhe?: string;
  icone: ReactNode;
}

// Ícones simples em traço; herdam a cor do texto do card.
const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const STAR = 'M18 5l3.8 8 8.7 1-6.4 6 1.7 8.7L18 24.4 10.2 28.7l1.7-8.7-6.4-6 8.7-1z';

const ESTILOS: Option<ShapeStyle>[] = [
  { id: 'contour', rotulo: 'Recorte no Contorno', icone: <Icon><path d={STAR} /></Icon> },
  { id: 'circle', rotulo: 'Redondo', icone: <Icon><circle cx="18" cy="18" r="13" /></Icon> },
  { id: 'square', rotulo: 'Quadrado', icone: <Icon><rect x="6" y="6" width="24" height="24" rx="3" /></Icon> },
  { id: 'rect', rotulo: 'Placa Retangular', icone: <Icon><rect x="3" y="9" width="30" height="18" rx="3" /></Icon> },
];

const sizeIcon = (r: number) => <Icon><rect x={18 - r} y={18 - r} width={2 * r} height={2 * r} rx="3" /></Icon>;
const TAMANHOS: Option<SizePreset>[] = [
  { id: 'P', rotulo: 'P', detalhe: '40 mm', icone: sizeIcon(7) },
  { id: 'M', rotulo: 'M', detalhe: '55 mm', icone: sizeIcon(10) },
  { id: 'G', rotulo: 'G', detalhe: '70 mm', icone: sizeIcon(14) },
];

const RELEVOS: Option<ReliefType>[] = [
  { id: 'raised', rotulo: 'Alto-Relevo', detalhe: 'desenho para fora', icone: <Icon><path d="M3 26h8V12h14v14h8" /></Icon> },
  { id: 'engraved', rotulo: 'Entalhado', detalhe: 'desenho para dentro', icone: <Icon><path d="M3 12h8v14h14V12h8" /></Icon> },
];

const ARGOLAS: Option<RingPosition>[] = [
  { id: 'top', rotulo: 'No Topo', icone: <Icon><rect x="8" y="13" width="20" height="18" rx="3" /><circle cx="18" cy="8" r="4" /></Icon> },
  { id: 'side', rotulo: 'Na Lateral', icone: <Icon><rect x="12" y="8" width="20" height="20" rx="3" /><circle cx="7" cy="18" r="4" /></Icon> },
  { id: 'none', rotulo: 'Sem Argola', icone: <Icon><rect x="7" y="7" width="22" height="22" rx="3" /></Icon> },
];

function Group<T extends string>({
  titulo,
  nome,
  opcoes,
  valor,
  onChange,
  colunas,
}: {
  titulo: string;
  nome: string;
  opcoes: Option<T>[];
  valor: T;
  onChange: (v: T) => void;
  colunas: number;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{titulo}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {opcoes.map((o) => (
          <label key={o.id} className="relative cursor-pointer">
            {/* Radio nativo escondido: setas do teclado funcionam sem código extra. */}
            <input
              type="radio"
              name={nome}
              className="peer sr-only"
              checked={valor === o.id}
              onChange={() => onChange(o.id)}
            />
            <span className="flex h-full flex-col items-center gap-1 rounded-lg border border-borda px-2 py-3 text-center text-apoio transition-colors hover:border-apoio peer-checked:border-destaque peer-checked:bg-destaque/10 peer-checked:text-texto peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-destaque">
              {o.icone}
              <span className="text-xs font-medium leading-tight">{o.rotulo}</span>
              {o.detalhe && <span className="text-[11px] leading-tight opacity-80">{o.detalhe}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Seal() {
  const stats = useStore((s) => s.result?.stats ?? null);
  const warnings = useStore((s) => s.warnings);
  if (!stats) return null;
  const w = Math.round(stats.totalMm.w);
  const h = Math.round(stats.totalMm.h);
  return (
    <div className="rounded-lg border border-borda bg-fundo p-3" aria-live="polite">
      <p className="text-sm">
        <span className="text-[#22C55E]">✓</span> Otimizado para impressão 3D — Tamanho final: {w} x {h} mm
      </p>
      {warnings.map((k) => (
        <p key={k} className="mt-2 text-xs text-apoio">
          {WARNING_TEXT[k]}
        </p>
      ))}
    </div>
  );
}

/** Modo Básico (7.5): quatro escolhas visuais e o selo de resultado. */
export default function BasicPanel() {
  const basic = useStore((s) => s.basic);
  const setBasic = useStore((s) => s.setBasic);

  return (
    <div className="flex flex-col gap-5 p-4">
      <Group titulo="Estilo" nome="estilo" opcoes={ESTILOS} valor={basic.style} onChange={(style) => setBasic({ style })} colunas={2} />
      <Group titulo="Tamanho" nome="tamanho" opcoes={TAMANHOS} valor={basic.size} onChange={(size) => setBasic({ size })} colunas={3} />
      <Group titulo="Tipo de Relevo" nome="relevo" opcoes={RELEVOS} valor={basic.reliefType} onChange={(reliefType) => setBasic({ reliefType })} colunas={2} />
      <Group titulo="Argola" nome="argola" opcoes={ARGOLAS} valor={basic.ringPosition} onChange={(ringPosition) => setBasic({ ringPosition })} colunas={3} />
      <Seal />
    </div>
  );
}
