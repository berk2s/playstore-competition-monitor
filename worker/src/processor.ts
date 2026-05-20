import { Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Types } from 'mongoose';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { AppModel, ScreenshotModel } from './models.ts';
import { captureListing, type ListingMetadata } from './capture.ts';
import { makeStorage, type StorageDriver } from './storage.ts';

export const CAPTURE_QUEUE = 'capture';

export interface CaptureJobData {
  appId: string;
  packageName: string;
  reason: 'scheduled' | 'manual';
}

export interface JobLike {
  id?: string | undefined;
  data: CaptureJobData;
  attemptsMade: number;
  opts: { attempts?: number };
}

export interface ProcessDeps {
  captureListing: (
    packageName: string,
  ) => Promise<{ buffer: Buffer; durationMs: number; metadata: ListingMetadata }>;
  storage: StorageDriver;
}

export type ProcessResult =
  | { ok: true; key: string; durationMs: number }
  | { skipped: true; reason: 'app_not_found' | 'app_inactive' };

export async function processCaptureJob(
  job: JobLike,
  deps: ProcessDeps,
): Promise<ProcessResult> {
  const { appId, packageName } = job.data;
  const log = logger.child({
    appId,
    packageName,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });
  log.info('capture start');

  const app = await AppModel.findById(appId);
  if (!app) {
    log.warn('app not found — dropping job');
    return { skipped: true, reason: 'app_not_found' };
  }
  if (!app.active) {
    log.info('app inactive — skipping');
    return { skipped: true, reason: 'app_inactive' };
  }

  try {
    const { buffer, durationMs, metadata } = await deps.captureListing(packageName);
    const capturedAt = new Date();
    const key = `apps/${appId}/${capturedAt.toISOString().replace(/[:.]/g, '-')}.png`;
    const stored = await deps.storage.put(key, buffer, 'image/png');

    await ScreenshotModel.create({
      appId: new Types.ObjectId(appId),
      status: 'success',
      imageKey: stored.key,
      imageUrl: stored.url,
      capturedAt,
      durationMs,
      metadata,
    });
    app.lastCapturedAt = capturedAt;
    await app.save();
    log.info({ durationMs, key: stored.key }, 'capture success');
    return { ok: true, key: stored.key, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      await ScreenshotModel.create({
        appId: new Types.ObjectId(appId),
        status: 'failed',
        capturedAt: new Date(),
        error: message.slice(0, 1000),
      });
    }
    log.error({ err: message, isFinalAttempt }, 'capture failed');
    throw err;
  }
}

export function startCaptureWorker() {
  const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const storage = makeStorage();

  const worker = new Worker<CaptureJobData>(
    CAPTURE_QUEUE,
    (job: Job<CaptureJobData>) =>
      processCaptureJob(
        { id: job.id, data: job.data, attemptsMade: job.attemptsMade, opts: job.opts },
        { captureListing, storage },
      ),
    { connection, concurrency: config.CAPTURE_CONCURRENCY },
  );

  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err: err.message }, 'job failed');
  });

  return { worker, connection };
}
