import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_DETECTED, deriveAdvanced } from '../../core/derive';
import { DEFAULT_BASIC, effectiveParams, useStore } from '../store';

const inicial = useStore.getState();

describe('store', () => {
  beforeEach(() => useStore.setState(inicial, true));

  it('no básico, os params efetivos são sempre derivados', () => {
    useStore.getState().setBasic({ size: 'G' });
    useStore.getState().setAdvanced({ widthMm: 123 });
    expect(effectiveParams(useStore.getState()).widthMm).toBe(70);
  });

  it('básico -> avançado inicializa o avançado com o derivado', () => {
    useStore.getState().setAdvanced({ widthMm: 123 });
    useStore.getState().setBasic({ size: 'P', ringPosition: 'side' });
    useStore.getState().setMode('advanced');
    const s = useStore.getState();
    expect(s.advanced).toEqual(
      deriveAdvanced({ ...DEFAULT_BASIC, size: 'P', ringPosition: 'side' }, DEFAULT_DETECTED),
    );
    useStore.getState().setAdvanced({ widthMm: 99 });
    expect(effectiveParams(useStore.getState()).widthMm).toBe(99);
  });

  it('voltar ao básico ignora o avançado e liga o aviso', () => {
    useStore.getState().setMode('advanced');
    useStore.getState().setAdvanced({ widthMm: 99 });
    useStore.getState().setMode('basic');
    const s = useStore.getState();
    expect(s.advancedIgnoredNotice).toBe(true);
    expect(effectiveParams(s).widthMm).toBe(55);
  });
});
