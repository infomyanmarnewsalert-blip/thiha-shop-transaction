// /lib/queues.ts
// Simple in-memory FIFO queue with configurable concurrency.
// Note: Works per server instance. For multi-instance deployments,
// use a shared queue (e.g., Redis/BullMQ).

type Task<T> = () => Promise<T>;

class SimpleQueue {
  private concurrency: number;
  private running = 0;
  private queue: Array<{ task: Task<any>; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  private maxPending: number;

  constructor(concurrency = 1, maxPending = 1000) {
    this.concurrency = Math.max(1, concurrency);
    this.maxPending = Math.max(1, maxPending);
  }

  size() {
    return this.queue.length + this.running;
  }

  add<T>(task: Task<T>): Promise<T> {
    if (this.queue.length >= this.maxPending) {
      return Promise.reject(Object.assign(new Error('queue_limit_exceeded'), { code: 'QUEUE_LIMIT' }));
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.pump();
    });
  }

  private pump() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;
      this.running++;
      (async () => {
        try {
          const val = await item.task();
          item.resolve(val);
        } catch (e) {
          item.reject(e);
        } finally {
          this.running--;
          // Next tick to avoid deep recursion
          setTimeout(() => this.pump(), 0);
        }
      })();
    }
  }
}

const queues = new Map<string, SimpleQueue>();

export function getQueue(name: string, concurrency = 1, maxPending = 1000) {
  const key = `${name}:${concurrency}:${maxPending}`;
  let q = queues.get(key);
  if (!q) {
    q = new SimpleQueue(concurrency, maxPending);
    queues.set(key, q);
  }
  return q;
}

