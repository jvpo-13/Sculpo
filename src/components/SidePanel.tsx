import { useStore } from '../state/store';
import AdvancedPanel from './AdvancedPanel';
import BasicPanel from './BasicPanel';

export default function SidePanel() {
  const mode = useStore((s) => s.mode);
  const aviso = useStore((s) => s.advancedIgnoredNotice);
  const dispensar = useStore((s) => s.dismissNotice);

  return (
    <aside
      aria-label={mode === 'basic' ? 'Controles do Modo Básico' : 'Controles do Modo Avançado'}
      className="w-full shrink-0 border-t border-borda bg-painel largo:w-[360px] largo:overflow-y-auto largo:border-l largo:border-t-0"
    >
      {mode === 'basic' && aviso && (
        <div role="status" className="flex items-start gap-2 border-b border-borda px-4 py-2 text-xs text-apoio">
          <span className="flex-1">Ajustes avançados não são usados no Modo Básico.</span>
          <button type="button" onClick={dispensar} aria-label="Dispensar aviso" className="px-1 hover:text-texto">
            ×
          </button>
        </div>
      )}
      {mode === 'basic' ? <BasicPanel /> : <AdvancedPanel />}
    </aside>
  );
}
