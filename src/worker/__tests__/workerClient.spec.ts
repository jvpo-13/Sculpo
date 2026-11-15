import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DETECTED, deriveAdvanced } from '../../core/derive';
import type { AdvancedParams, FromWorker, ToWorker } from '../../types';
import { MSG_TIMEOUT, TIMEOUT_MS, WorkerClient, WorkerError, type WorkerLike } from '../workerClient';

class FakeWorker implements WorkerLike {
  onmessage: ((data: FromWorker) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: ToWorker[] = [];
  terminated = false;
  postMessage(msg: ToWorker) { this.sent.push(msg); }
  terminate() { this.terminated = true; }
  get last(): ToWorker { return this.sent[this.sent.length - 1]; }
  reply(data: FromWorker) { this.onmessage?.(data); }
}

const params = (widthMm: number): AdvancedParams => ({
  ...deriveAdvanced({ style: 'rect', size: 'M', reliefType: 'raised', ringPosition: 'top' }, DEFAULT_DETECTED),
  widthMm,
});
const built = (id: number): FromWorker => ({
  type: 'built',
  id,
  preview: { data: new Uint8Array(1), w: 1, h: 1 },
  mesh: { positions: new Float32Array(9), indices: new Uint32Array(3) },
  stats: { triangles: 1, ms: 1, bodyMm: { w: 1, h: 1 }, totalMm: { w: 1, h: 1 }, colorSwapZ: 2, warnings: [] },
});
const loaded = (id: number): FromWorker => ({ type: 'loaded', id, width: 10, height: 10, detected: DEFAULT_DETECTED });
const blob = () => new Blob(['x']);

describe('WorkerClient', () => {
  let workers: FakeWorker[];
  let client: WorkerClient;
  const current = () => workers[workers.length - 1];

  beforeEach(() => {
    vi.useFakeTimers();
    workers = [];
    client = new WorkerClient(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolve cada requisição pelo id', async () => {
    const p = client.build(params(40));
    expect(current().last).toMatchObject({ type: 'build', id: 1 });
    current().reply(built(1));
    expect((await p)?.id).toBe(1);
  });

  it('última vence: 1 em voo + só o pendente mais recente', async () => {
    const a = client.build(params(40));
    const b = client.build(params(50));
    const c = client.build(params(60));
    // Só o primeiro foi enviado; b foi substituído por c antes de sair.
    expect(current().sent.length).toBe(1);
    expect(await b).toBeNull();

    current().reply(built(1));
    expect(await a).toBeNull(); // resposta antiga descartada
    expect(current().sent.length).toBe(2);
    expect(current().last).toMatchObject({ type: 'build', id: 2, params: { widthMm: 60 } });

    current().reply(built(2));
    expect((await c)?.id).toBe(2);
  });

  it('ignora respostas com id que não está em voo', async () => {
    const p = client.build(params(40));
    current().reply(built(99));
    current().reply(built(1));
    expect((await p)?.id).toBe(1);
  });

  it('exportação não é derrubada por builds seguintes', async () => {
    const a = client.build(params(40));
    const stl = client.exportStl(params(40));
    const b = client.build(params(50));
    current().reply(built(1));
    expect(await a).toBeNull();
    current().reply(built(2)); // build mais novo sai antes do export
    expect((await b)?.id).toBe(2);
    expect(current().last).toMatchObject({ type: 'exportStl', id: 3 });
    current().reply({ type: 'stl', id: 3, buffer: new ArrayBuffer(84), triangles: 0 });
    expect((await stl)?.type).toBe('stl');
  });

  it('um novo load invalida o que estava em voo e na fila', async () => {
    const a = client.build(params(40));
    const b = client.build(params(50));
    const l = client.load(blob());
    expect(await b).toBeNull();
    current().reply(built(1));
    expect(await a).toBeNull();
    expect(current().last).toMatchObject({ type: 'load', id: 2 });
    current().reply(loaded(2));
    expect((await l)?.type).toBe('loaded');
  });

  it('erro do worker rejeita com o código e a mensagem', async () => {
    const p = client.load(blob());
    current().reply({ type: 'error', id: 1, code: 'blank', message: 'Não detectamos um desenho nesta imagem.' });
    await expect(p).rejects.toMatchObject({ code: 'blank', message: 'Não detectamos um desenho nesta imagem.' });
  });

  it('timeout de 30 s: mata o worker, recria e recarrega o arquivo guardado', async () => {
    const file = blob();
    const l = client.load(file);
    current().reply(loaded(1));
    await l;

    const p = client.build(params(40));
    const first = current();
    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    expect(first.terminated).toBe(false);
    vi.advanceTimersByTime(1);

    expect(first.terminated).toBe(true);
    expect(workers.length).toBe(2);
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WorkerError);
    expect(err).toMatchObject({ code: 'timeout', message: MSG_TIMEOUT });

    // O worker novo recebe o mesmo arquivo e volta a aceitar builds.
    const reload = current().last;
    expect(reload.type).toBe('load');
    expect(reload.type === 'load' && reload.blob).toBe(file);
    const next = client.build(params(50));
    current().reply(loaded(reload.id));
    current().reply(built(reload.id + 1));
    expect((await next)?.type).toBe('built');
  });

  it('timeout no próprio load não reenvia o arquivo (evita laço)', async () => {
    const p = client.load(blob());
    vi.advanceTimersByTime(TIMEOUT_MS);
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
    expect(workers.length).toBe(2);
    expect(current().sent.length).toBe(0);
  });

  it('resposta que chega a tempo cancela o timeout', async () => {
    const p = client.build(params(40));
    current().reply(built(1));
    await p;
    vi.advanceTimersByTime(TIMEOUT_MS * 2);
    expect(workers.length).toBe(1);
  });
});
