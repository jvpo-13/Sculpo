import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';

/** Preview 2D do mapa de alturas (1 canal), em escala "contain" e pixelado. */
export default function PreviewCanvas({ size = 280 }: { size?: number }) {
  const preview = useStore((s) => s.result?.preview ?? null);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !preview) return;
    canvas.width = preview.w;
    canvas.height = preview.h;
    const g = canvas.getContext('2d');
    if (!g) return;
    const image = g.createImageData(preview.w, preview.h);
    for (let p = 0, q = 0; p < preview.data.length; p++, q += 4) {
      const v = preview.data[p];
      image.data[q] = v;
      image.data[q + 1] = v;
      image.data[q + 2] = v;
      image.data[q + 3] = 255;
    }
    g.putImageData(image, 0, 0);
  }, [preview]);

  return (
    <div
      className="flex items-center justify-center rounded-lg border border-borda bg-black"
      style={{ width: size, height: size, maxWidth: '100%' }}
    >
      {preview ? (
        <canvas
          ref={ref}
          role="img"
          aria-label="Prévia do relevo: quanto mais claro, mais alto"
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <span className="text-xs text-apoio">Prévia 2D</span>
      )}
    </div>
  );
}
