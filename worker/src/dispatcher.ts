import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { AppModel } from './models.ts';
import { CAPTURE_QUEUE } from './processor.ts';

const DISPATCH_QUEUE = 'dispatch';
const DISPATCH_JOB = 'dispatch';

export interface QueueLike {
  add(name: string, data: unknown, opts?: unknown): Promise<unknown>;
}

export async function dispatchTick(queue: QueueLike): Promise<number> {
  const apps = await AppModel.find({ active: true }).select('_id packageName');
  logger.info({ count: apps.length }, 'dispatch tick: enqueueing captures');
  let i = 0;
  for (const app of apps) {
    await queue.add(
      'capture',
      { appId: app._id.toString(), packageName: app.packageName, reason: 'scheduled' },
      {
        attempts: config.CAPTURE_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5_000 },
        delay: i * 2_000,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );
    i += 1;
  }
  return apps.length;
}

export async function startDispatcher() {
  const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const captureQueue = new Queue(CAPTURE_QUEUE, { connection });
  const dispatchQueue = new Queue(DISPATCH_QUEUE, { connection });

  await dispatchQueue.add(
    DISPATCH_JOB,
    { tick: true },
    { repeat: { pattern: config.CAPTURE_CRON }, jobId: 'dispatch-tick' },
  );

  const dispatcher = new Worker(
    DISPATCH_QUEUE,
    async () => {
      await dispatchTick(captureQueue);
    },
    { connection, concurrency: 1 },
  );

  return { dispatcher, queue: dispatchQueue, captureQueue, connection };
}
