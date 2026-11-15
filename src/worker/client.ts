import type { FromWorker } from '../types';
import { WorkerClient, type WorkerLike } from './workerClient';

// Adapta o Worker do navegador para a interface mínima do cliente.
function browserWorker(): WorkerLike {
  const worker = new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' });
  const like: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (msg) => worker.postMessage(msg),
    terminate: () => worker.terminate(),
  };
  worker.onmessage = (ev: MessageEvent<FromWorker>) => like.onmessage?.(ev.data);
  worker.onerror = () => like.onerror?.();
  return like;
}

let client: WorkerClient | null = null;

/** Cliente único da aplicação, criado no primeiro uso. */
export function getClient(): WorkerClient {
  if (!client) client = new WorkerClient(browserWorker);
  return client;
}
