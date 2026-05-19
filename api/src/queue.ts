import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from './config.ts';

export const CAPTURE_QUEUE = 'capture';

export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const captureQueue = new Queue(CAPTURE_QUEUE, { connection: redis });

export interface CaptureJobData {
  appId: string;
  packageName: string;
  reason: 'scheduled' | 'manual';
}

export async function enqueueCapture(data: CaptureJobData) {
  return captureQueue.add('capture', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  });
}
