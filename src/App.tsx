import { useEffect } from 'react';
import Header from './components/Header';
import SidePanel from './components/SidePanel';
import ViewportPlaceholder from './components/ViewportPlaceholder';
import { startAutoRebuild } from './state/actions';

// Layout da Parte 7.1: barra fixa, viewport flexível, painel de 360px à
// direita (abaixo do viewport quando a janela tem menos de 900px).
export default function App() {
  // Mudou um parâmetro efetivo -> novo build no worker.
  useEffect(() => startAutoRebuild(), []);

  return (
    <div className="flex h-full flex-col bg-fundo text-texto">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto largo:flex-row largo:overflow-hidden">
        <main className="relative min-h-[320px] flex-1 largo:min-h-0" aria-label="Visualização 3D">
          <ViewportPlaceholder />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
