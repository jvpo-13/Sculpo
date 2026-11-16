import { useEffect, useRef, useState } from 'react';
import { filamentHex } from '../state/filaments';
import { useStore } from '../state/store';
import { createScene, type SceneApi } from './scene';

/** Viewport 3D. `resetSignal` muda a cada clique em "Resetar câmera". */
export default function Viewport({ resetSignal }: { resetSignal: number }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<SceneApi | null>(null);
  const [failed, setFailed] = useState(false);

  const mesh = useStore((s) => s.result?.mesh ?? null);
  const colorSwapZ = useStore((s) => s.result?.stats.colorSwapZ ?? 2);
  const baseColor = useStore((s) => s.baseColor);
  const reliefColor = useStore((s) => s.reliefColor);

  // O renderer é criado uma vez; novas malhas só trocam a geometria.
  useEffect(() => {
    if (!host.current) return;
    try {
      api.current = createScene(host.current);
    } catch {
      setFailed(true);
      return;
    }
    return () => {
      api.current?.dispose();
      api.current = null;
    };
  }, []);

  useEffect(() => {
    api.current?.setMesh(mesh, colorSwapZ);
  }, [mesh, colorSwapZ]);

  useEffect(() => {
    api.current?.setColors(filamentHex(baseColor), filamentHex(reliefColor));
  }, [baseColor, reliefColor]);

  useEffect(() => {
    if (resetSignal === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    api.current?.resetCamera(!reduced);
  }, [resetSignal]);

  return (
    <div ref={host} className="absolute inset-0">
      {failed && (
        <p className="flex h-full items-center justify-center p-6 text-center text-sm text-apoio">
          Não foi possível abrir a visualização 3D neste navegador. O download do STL continua funcionando.
        </p>
      )}
    </div>
  );
}
