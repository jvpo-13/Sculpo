export type Channel = 'luma' | 'red' | 'green' | 'blue' | 'saturation' | 'alpha';
export type CaptureMode = 'continuous' | 'threshold' | 'sobel';
export type ShapeStyle = 'contour' | 'circle' | 'square' | 'rect';
export type SizePreset = 'P' | 'M' | 'G';            // 40 / 55 / 70 mm
export type ReliefType = 'raised' | 'engraved';
export type RingPosition = 'top' | 'side' | 'none';
export type FilamentColor = 'black' | 'white' | 'terracotta' | 'blue' | 'green' | 'pink';

export interface BasicParams {
  style: ShapeStyle;
  size: SizePreset;
  reliefType: ReliefType;
  ringPosition: RingPosition;
}

// Parâmetros COMPLETOS do pipeline. O worker só conhece este tipo.
export interface AdvancedParams {
  style: ShapeStyle;
  reliefType: ReliefType;

  channel: Channel;
  captureMode: CaptureMode;
  threshold: number;        // 0..255, só em threshold
  brightness: number;       // -100..100
  contrast: number;         // -100..100
  gamma: number;            // 0.4..2.5
  invert: boolean;
  blurPx: number;           // 0..5   (px na resolução de trabalho R=512)
  morphology: number;       // -3..3  (erode..dilate, px em R=512)
  layers: number;           // 0=contínuo, 2..6=quantizado

  widthMm: number;          // 20..200 — MAIOR LADO DO CORPO (sem argola)
  baseThicknessMm: number;  // 1.2..5.0
  maxReliefMm: number;      // 0.4..6.0
  marginMm: number;         // 0..10
  protectiveBorder: boolean;

  ringEnabled: boolean;
  ringPosX: number;         // -1..1
  ringPosY: number;         // -1..1 (1 = topo)
  ringOuterMm: number;      // 4..12  (diâmetro)
  ringHoleMm: number;       // 1.5..6 (diâmetro)
  minIslandMm: number;      // 0..3
  meshResolution: number;   // 80..250 (células no maior lado)
}

export interface Detected {
  channel: Channel;
  captureMode: CaptureMode;
  threshold: number;
  invert: boolean;
  hasAlpha: boolean;        // >1% dos pixels com alpha < 250
  lumaStdDev: number;
  blank: boolean;           // sem desenho (ver 3.2)
  lowContrast: boolean;
}

export type Warning = 'lowContrast' | 'contourFallback' | 'looseParts';

export interface BuildStats {
  triangles: number;
  ms: number;
  bodyMm: { w: number; h: number };    // corpo, sem argola
  totalMm: { w: number; h: number };   // com argola (é o que o selo mostra)
  colorSwapZ: number;                  // = baseThicknessMm
  warnings: Warning[];
}

export type ErrorCode = 'decode' | 'blank' | 'unsupported' | 'timeout';

// Mensagens. Toda resposta carrega o `id` da requisição.
export type ToWorker =
  | { type: 'load'; id: number; blob: Blob }
  | { type: 'build'; id: number; params: AdvancedParams }
  | { type: 'exportStl'; id: number; params: AdvancedParams };

export type FromWorker =
  | { type: 'loaded'; id: number; width: number; height: number; detected: Detected }
  | { type: 'built'; id: number;
      preview: { data: Uint8Array; w: number; h: number };      // 1 canal, 0..255
      mesh: { positions: Float32Array; indices: Uint32Array };  // transferíveis
      stats: BuildStats }
  | { type: 'stl'; id: number; buffer: ArrayBuffer; triangles: number }
  | { type: 'error'; id: number; code: ErrorCode; message: string };
