import type { AdvancedParams, ErrorCode, FromWorker, ToWorker } from '../types';

export const TIMEOUT_MS = 30_000;
export const MSG_TIMEOUT = 'Processamento demorou demais. Tente uma imagem menor.';
const MSG_CRASH = 'Não foi possível processar esta imagem.';

/** O mínimo de um Worker que o cliente usa (permite um worker falso nos testes). */
export interface WorkerLike {
  postMessage(msg: ToWorker): void;
  terminate(): void;
  onmessage: ((data: FromWorker) => void) | null;
  onerror: (() => void) | null;
}

export type Loaded = Extract<FromWorker, { type: 'loaded' }>;
export type Built = Extract<FromWorker, { type: 'built' }>;
export type Stl = Extract<FromWorker, { type: 'stl' }>;

export class WorkerError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'WorkerError';
  }
}

type Kind = ToWorker['type'];
type Body =
  | { type: 'load'; blob: Blob }
  | { type: 'build'; params: AdvancedParams }
  | { type: 'exportStl'; params: AdvancedParams };

interface Job {
  body: Body;
  id: number;
  stale: boolean; // resposta será descartada (algo mais novo chegou)
  resolve: (value: FromWorker | null) => void;
  reject: (err: WorkerError) => void;
}

const ORDER: Kind[] = ['load', 'build', 'exportStl'];

/**
 * Cliente do worker: uma Promise por id, última requisição vence.
 * Mantém 1 requisição em voo + 1 pendente por tipo (a mais recente).
 * Uma Promise resolve com `null` quando foi superada por outra mais nova.
 */
export class WorkerClient {
  private worker: WorkerLike;
  private nextId = 1;
  private flight: Job | null = null;
  private pending: Partial<Record<Kind, Job>> = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  // Último arquivo carregado com sucesso: reenviado se o worker for recriado.
  private file: Blob | null = null;

  constructor(
    private readonly create: () => WorkerLike,
    private readonly timeoutMs = TIMEOUT_MS,
  ) {
    this.worker = this.spawn();
  }

  load(blob: Blob): Promise<Loaded | null> {
    return this.enqueue({ type: 'load', blob }) as Promise<Loaded | null>;
  }

  build(params: AdvancedParams): Promise<Built | null> {
    return this.enqueue({ type: 'build', params }) as Promise<Built | null>;
  }

  exportStl(params: AdvancedParams): Promise<Stl | null> {
    return this.enqueue({ type: 'exportStl', params }) as Promise<Stl | null>;
  }

  dispose(): void {
    this.clearTimer();
    this.worker.terminate();
  }

  private spawn(): WorkerLike {
    const w = this.create();
    w.onmessage = (data) => this.onMessage(data);
    w.onerror = () => this.onCrash();
    return w;
  }

  private enqueue(body: Body): Promise<FromWorker | null> {
    return new Promise((resolve, reject) => {
      const job: Job = { body, id: 0, stale: false, resolve, reject };
      if (body.type === 'load') {
        // Nova imagem invalida tudo o que estava na fila ou em voo.
        this.dropPending();
        if (this.flight) this.flight.stale = true;
      } else {
        this.pending[body.type]?.resolve(null);
        if (this.flight?.body.type === body.type) this.flight.stale = true;
      }
      this.pending[body.type] = job;
      this.pump();
    });
  }

  private dropPending(): void {
    for (const kind of ORDER) {
      this.pending[kind]?.resolve(null);
      delete this.pending[kind];
    }
  }

  private pump(): void {
    if (this.flight) return;
    for (const kind of ORDER) {
      const job = this.pending[kind];
      if (!job) continue;
      delete this.pending[kind];
      job.id = this.nextId++;
      this.flight = job;
      this.timer = setTimeout(() => this.onTimeout(), this.timeoutMs);
      this.worker.postMessage({ ...job.body, id: job.id } as ToWorker);
      return;
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private onMessage(data: FromWorker): void {
    const job = this.flight;
    if (!job || data.id !== job.id) return; // id antigo: descarta
    this.clearTimer();
    this.flight = null;

    if (job.stale) {
      job.resolve(null);
    } else if (data.type === 'error') {
      job.reject(new WorkerError(data.code, data.message));
    } else {
      if (job.body.type === 'load') this.file = job.body.blob;
      job.resolve(data);
    }
    this.pump();
  }

  private onCrash(): void {
    const job = this.flight;
    if (!job) return;
    this.clearTimer();
    this.flight = null;
    if (job.stale) job.resolve(null);
    else job.reject(new WorkerError('decode', MSG_CRASH));
    this.pump();
  }

  private onTimeout(): void {
    const job = this.flight;
    this.timer = null;
    this.flight = null;
    this.worker.terminate();
    this.worker = this.spawn();

    // Builds/exports na fila dependiam do estado do worker que morreu.
    for (const kind of ['build', 'exportStl'] as const) {
      this.pending[kind]?.resolve(null);
      delete this.pending[kind];
    }

    if (job?.body.type === 'load') {
      // O próprio load estourou: reenviar o mesmo arquivo só repetiria o timeout.
      this.file = null;
    } else if (this.file && !this.pending.load) {
      // Recarrega em silêncio a imagem atual no worker novo.
      this.pending.load = {
        body: { type: 'load', blob: this.file },
        id: 0,
        stale: false,
        resolve: () => undefined,
        reject: () => undefined,
      };
    }

    if (job) {
      if (job.stale) job.resolve(null);
      else job.reject(new WorkerError('timeout', MSG_TIMEOUT));
    }
    this.pump();
  }
}
