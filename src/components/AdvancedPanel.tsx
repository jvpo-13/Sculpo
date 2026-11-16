import { useStore } from '../state/store';
import type { AdvancedParams, CaptureMode, Channel, ReliefType, ShapeStyle } from '../types';
import PreviewCanvas from './PreviewCanvas';
import { RadioRow, Section, Select, Slider, Toggle } from './controls';

const CANAIS: { id: Channel; rotulo: string }[] = [
  { id: 'luma', rotulo: 'Luminosidade' },
  { id: 'red', rotulo: 'Vermelho' },
  { id: 'green', rotulo: 'Verde' },
  { id: 'blue', rotulo: 'Azul' },
  { id: 'saturation', rotulo: 'Saturação' },
  { id: 'alpha', rotulo: 'Transparência' },
];
const CAPTURAS: { id: CaptureMode; rotulo: string }[] = [
  { id: 'continuous', rotulo: 'Contínuo' },
  { id: 'threshold', rotulo: 'Threshold' },
  { id: 'sobel', rotulo: 'Sobel' },
];
const ESTILOS: { id: ShapeStyle; rotulo: string }[] = [
  { id: 'contour', rotulo: 'Recorte no Contorno' },
  { id: 'circle', rotulo: 'Redondo' },
  { id: 'square', rotulo: 'Quadrado' },
  { id: 'rect', rotulo: 'Placa Retangular' },
];
const RELEVOS: { id: ReliefType; rotulo: string }[] = [
  { id: 'raised', rotulo: 'Alto-Relevo' },
  { id: 'engraved', rotulo: 'Entalhado' },
];

const mm = (casas: number) => (v: number) => `${v.toFixed(casas)} mm`;
const sinal = (v: number) => (v > 0 ? `+${v}` : String(v));

function Footer() {
  const stats = useStore((s) => s.result?.stats ?? null);
  if (!stats) return null;
  return (
    <p className="border-t border-borda px-4 py-3 text-xs tabular-nums text-apoio" aria-live="polite">
      Triângulos: {stats.triangles.toLocaleString('pt-BR')} · Tempo: {stats.ms} ms · Troca de cor em Z ={' '}
      {stats.colorSwapZ.toFixed(1)} mm
    </p>
  );
}

/** Modo Avançado (7.6): todos os parâmetros do pipeline. */
export default function AdvancedPanel() {
  const a = useStore((s) => s.advanced);
  const setAdvanced = useStore((s) => s.setAdvanced);
  const set = <K extends keyof AdvancedParams>(key: K) => (value: AdvancedParams[K]) =>
    setAdvanced({ [key]: value } as Pick<AdvancedParams, K>);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 p-4">
        <div className="mx-auto">
          <PreviewCanvas size={280} />
        </div>

        <Section titulo="Captura e Tratamento">
          <Select id="adv-canal" rotulo="Canal" valor={a.channel} opcoes={CANAIS} onChange={set('channel')} />
          <RadioRow nome="adv-captura" rotulo="Modo de Captura" valor={a.captureMode} opcoes={CAPTURAS} onChange={set('captureMode')} />
          {a.captureMode === 'threshold' && (
            <Slider id="adv-threshold" rotulo="Threshold" min={0} max={255} step={1} valor={a.threshold} onChange={set('threshold')} />
          )}
          <Slider id="adv-brilho" rotulo="Brilho" min={-100} max={100} step={1} valor={a.brightness} onChange={set('brightness')} formato={sinal} />
          <Slider id="adv-contraste" rotulo="Contraste" min={-100} max={100} step={1} valor={a.contrast} onChange={set('contrast')} formato={sinal} />
          <Slider id="adv-gama" rotulo="Gama" min={0.4} max={2.5} step={0.05} valor={a.gamma} onChange={set('gamma')} formato={(v) => v.toFixed(2)} />
          <Toggle id="adv-inverter" rotulo="Inverter Tons" valor={a.invert} onChange={set('invert')} />
          <Slider id="adv-ruido" rotulo="Remover Ruído" min={0} max={5} step={1} valor={a.blurPx} onChange={set('blurPx')} />
          <Slider id="adv-morfologia" rotulo="Engrossar/Afinar" min={-3} max={3} step={1} valor={a.morphology} onChange={set('morphology')} formato={sinal} />
          <Slider
            id="adv-camadas"
            rotulo="Níveis de Camada"
            min={0}
            max={6}
            step={1}
            valor={a.layers}
            onChange={set('layers')}
            formato={(v) => (v < 2 ? 'contínuo' : String(v))}
          />
        </Section>

        <Section titulo="Estrutura (mm)">
          <Select id="adv-estilo" rotulo="Estilo" valor={a.style} opcoes={ESTILOS} onChange={set('style')} />
          <RadioRow nome="adv-relevo" rotulo="Tipo de Relevo" valor={a.reliefType} opcoes={RELEVOS} onChange={set('reliefType')} />
          <Slider id="adv-largura" rotulo="Largura" min={20} max={200} step={1} valor={a.widthMm} onChange={set('widthMm')} formato={mm(0)} />
          <Slider id="adv-base" rotulo="Espessura da Base" min={1.2} max={5} step={0.1} valor={a.baseThicknessMm} onChange={set('baseThicknessMm')} formato={mm(1)} />
          <Slider id="adv-relevo-altura" rotulo="Altura Máxima do Relevo" min={0.4} max={6} step={0.1} valor={a.maxReliefMm} onChange={set('maxReliefMm')} formato={mm(1)} />
          <Slider id="adv-margem" rotulo="Margem de Borda" min={0} max={10} step={0.5} valor={a.marginMm} onChange={set('marginMm')} formato={mm(1)} />
          <Toggle id="adv-borda" rotulo="Borda Protetora Elevada" valor={a.protectiveBorder} onChange={set('protectiveBorder')} />
        </Section>

        <Section titulo="Argola e Malha">
          <Toggle id="adv-argola" rotulo="Usar Argola" valor={a.ringEnabled} onChange={set('ringEnabled')} />
          <Slider id="adv-argola-x" rotulo="Posição X" min={-1} max={1} step={0.05} valor={a.ringPosX} onChange={set('ringPosX')} formato={(v) => v.toFixed(2)} disabled={!a.ringEnabled} />
          <Slider id="adv-argola-y" rotulo="Posição Y" min={-1} max={1} step={0.05} valor={a.ringPosY} onChange={set('ringPosY')} formato={(v) => v.toFixed(2)} disabled={!a.ringEnabled} />
          <Slider id="adv-argola-externo" rotulo="Diâmetro Externo" min={4} max={12} step={0.5} valor={a.ringOuterMm} onChange={set('ringOuterMm')} formato={mm(1)} disabled={!a.ringEnabled} />
          <Slider id="adv-argola-furo" rotulo="Diâmetro do Furo" min={1.5} max={6} step={0.1} valor={a.ringHoleMm} onChange={set('ringHoleMm')} formato={mm(1)} disabled={!a.ringEnabled} />
          <Slider id="adv-ilhas" rotulo="Filtro de Ilhas Mínimas" min={0} max={3} step={0.1} valor={a.minIslandMm} onChange={set('minIslandMm')} formato={mm(1)} />
          <Slider id="adv-resolucao" rotulo="Resolução da Malha" min={80} max={250} step={5} valor={a.meshResolution} onChange={set('meshResolution')} />
        </Section>
      </div>
      <Footer />
    </div>
  );
}
