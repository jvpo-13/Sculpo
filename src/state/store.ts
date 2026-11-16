import { create } from 'zustand';
import { DEFAULT_DETECTED, deriveAdvanced } from '../core/derive';
import type {
  AdvancedParams,
  BasicParams,
  BuildStats,
  Detected,
  ExportQuality,
  FilamentColor,
  Warning,
} from '../types';

export type Mode = 'basic' | 'advanced';

export interface ImageInfo {
  name: string;
  width: number;
  height: number;
}

// Resultado do último build. O heightmap NUNCA entra aqui: fica no worker.
export interface BuildResult {
  preview: { data: Uint8Array; w: number; h: number };
  mesh: { positions: Float32Array; indices: Uint32Array };
  stats: BuildStats;
}

export const DEFAULT_BASIC: BasicParams = {
  style: 'contour',
  size: 'M',
  reliefType: 'raised',
  ringPosition: 'top',
};

export interface SculpoState {
  mode: Mode;
  basic: BasicParams;
  advanced: AdvancedParams;
  detected: Detected | null;

  // Metadados + File original (necessário para recriar o worker após timeout).
  image: ImageInfo | null;
  file: File | null;

  result: BuildResult | null;
  busy: boolean;
  error: string | null;
  warnings: Warning[];
  // Aviso discreto ao voltar do avançado para o básico.
  advancedIgnoredNotice: boolean;

  baseColor: FilamentColor;
  reliefColor: FilamentColor;
  // Qualidade do STL baixado ('high' dobra a resolução da malha).
  exportQuality: ExportQuality;
  exporting: boolean;

  setMode: (mode: Mode) => void;
  setBasic: (patch: Partial<BasicParams>) => void;
  setAdvanced: (patch: Partial<AdvancedParams>) => void;
  setImage: (file: File, info: ImageInfo, detected: Detected) => void;
  clearImage: () => void;
  setResult: (result: BuildResult | null) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
  setColors: (patch: { baseColor?: FilamentColor; reliefColor?: FilamentColor }) => void;
  dismissNotice: () => void;
  setExportQuality: (quality: ExportQuality) => void;
  setExporting: (exporting: boolean) => void;
}

/** Params EFETIVOS enviados ao worker: derivados no básico, livres no avançado. */
export function effectiveParams(
  s: Pick<SculpoState, 'mode' | 'basic' | 'advanced' | 'detected'>,
): AdvancedParams {
  return s.mode === 'basic'
    ? deriveAdvanced(s.basic, s.detected ?? DEFAULT_DETECTED)
    : s.advanced;
}

export const useStore = create<SculpoState>((set) => ({
  mode: 'basic',
  basic: DEFAULT_BASIC,
  advanced: deriveAdvanced(DEFAULT_BASIC, DEFAULT_DETECTED),
  detected: null,

  image: null,
  file: null,

  result: null,
  busy: false,
  error: null,
  warnings: [],
  advancedIgnoredNotice: false,

  baseColor: 'white',
  reliefColor: 'terracotta',
  exportQuality: 'normal',
  exporting: false,

  setMode: (mode) =>
    set((s) => {
      if (mode === s.mode) return s;
      if (mode === 'advanced') {
        // Ponto de partida sensato: o que o básico estava produzindo.
        return {
          mode,
          advanced: deriveAdvanced(s.basic, s.detected ?? DEFAULT_DETECTED),
          advancedIgnoredNotice: false,
        };
      }
      return { mode, advancedIgnoredNotice: true };
    }),

  setBasic: (patch) => set((s) => ({ basic: { ...s.basic, ...patch } })),
  setAdvanced: (patch) => set((s) => ({ advanced: { ...s.advanced, ...patch } })),

  setImage: (file, info, detected) =>
    set((s) => ({
      file,
      image: info,
      detected,
      error: null,
      // No avançado, a nova imagem reinicia os ajustes a partir da detecção.
      advanced: deriveAdvanced(s.basic, detected),
    })),

  // Carregamento falhou: nenhuma malha pode ficar disponível para download.
  clearImage: () => set({ file: null, image: null, detected: null, result: null, warnings: [] }),

  setResult: (result) => set({ result, warnings: result ? result.stats.warnings : [] }),
  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
  setColors: (patch) => set(patch),
  dismissNotice: () => set({ advancedIgnoredNotice: false }),
  setExportQuality: (exportQuality) => set({ exportQuality }),
  setExporting: (exporting) => set({ exporting }),
}));
