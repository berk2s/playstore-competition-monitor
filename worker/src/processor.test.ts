import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModel, ScreenshotModel } from './models.ts';
import {
  processCaptureJob,
  type JobLike,
  type ProcessDeps,
  type CaptureJobData,
} from './processor.ts';
import type { StorageDriver } from './storage.ts';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await AppModel.deleteMany({});
  await ScreenshotModel.deleteMany({});
});

function makeJob(data: CaptureJobData, attemptsMade = 0, attempts = 3): JobLike {
  return { id: 'job-1', data, attemptsMade, opts: { attempts } };
}

function makeDeps(overrides: Partial<ProcessDeps> = {}): {
  deps: ProcessDeps;
  captureListing: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
} {
  const captureListing =
    (overrides.captureListing as ReturnType<typeof vi.fn>) ??
    vi.fn(async () => ({
      buffer: Buffer.from('png'),
      durationMs: 123,
      metadata: {
        title: 'Example',
        developer: 'Acme',
        iconUrl: 'https://x/icon.png',
        rating: 4.5,
        ratingCount: 1000,
        installs: '100M+',
        price: 'Free',
        containsAds: true,
        inAppPurchases: false,
        updatedOn: 'Jul 12, 2024',
        version: '1.2.3',
        size: '120 MB',
        minAndroid: 'Android 7.0+',
        whatsNew: 'Bug fixes.',
        shortDescription: null,
        longDescription: 'A long description.',
      },
    }));
  const put =
    overrides.storage
      ? (overrides.storage.put as ReturnType<typeof vi.fn>)
      : vi.fn(async (key: string) => ({ key, url: `http://x/${key}` }));
  const storage: StorageDriver = overrides.storage ?? { put };
  return { deps: { captureListing, storage }, captureListing, put };
}

describe('processCaptureJob', () => {
  it('captures, stores, persists a success row, and stamps lastCapturedAt', async () => {
    const app = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
    });
    const { deps, captureListing, put } = makeDeps();

    const result = await processCaptureJob(
      makeJob({ appId: app._id.toString(), packageName: app.packageName, reason: 'manual' }),
      deps,
    );

    expect(result).toMatchObject({ ok: true, durationMs: 123 });
    expect(captureListing).toHaveBeenCalledWith('com.example.app');
    expect(put).toHaveBeenCalledTimes(1);
    const [keyArg, bodyArg, contentTypeArg] = put.mock.calls[0]!;
    expect(keyArg).toMatch(new RegExp(`^apps/${app._id.toString()}/.+\\.png$`));
    expect((bodyArg as Buffer).equals(Buffer.from('png'))).toBe(true);
    expect(contentTypeArg).toBe('image/png');

    const shots = await ScreenshotModel.find({ appId: app._id });
    expect(shots).toHaveLength(1);
    expect(shots[0]!.status).toBe('success');
    expect(shots[0]!.imageKey).toBe(keyArg);
    expect(shots[0]!.durationMs).toBe(123);
    expect(shots[0]!.metadata?.rating).toBe(4.5);
    expect(shots[0]!.metadata?.installs).toBe('100M+');
    expect(shots[0]!.metadata?.version).toBe('1.2.3');

    const reloaded = await AppModel.findById(app._id);
    expect(reloaded?.lastCapturedAt).toBeInstanceOf(Date);
  });

  it('returns skipped when the app no longer exists', async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    const { deps, captureListing, put } = makeDeps();

    const result = await processCaptureJob(
      makeJob({ appId: missingId, packageName: 'com.example.app', reason: 'scheduled' }),
      deps,
    );

    expect(result).toEqual({ skipped: true, reason: 'app_not_found' });
    expect(captureListing).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(await ScreenshotModel.countDocuments()).toBe(0);
  });

  it('returns skipped when the app is inactive', async () => {
    const app = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
      active: false,
    });
    const { deps, captureListing } = makeDeps();

    const result = await processCaptureJob(
      makeJob({ appId: app._id.toString(), packageName: app.packageName, reason: 'scheduled' }),
      deps,
    );

    expect(result).toEqual({ skipped: true, reason: 'app_inactive' });
    expect(captureListing).not.toHaveBeenCalled();
    expect(await ScreenshotModel.countDocuments()).toBe(0);
  });

  it('on a non-final attempt failure: rethrows and does not persist a failed row', async () => {
    const app = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
    });
    const { deps } = makeDeps({
      captureListing: vi.fn(async () => {
        throw new Error('navigation timed out');
      }),
    });

    await expect(
      processCaptureJob(
        makeJob(
          { appId: app._id.toString(), packageName: app.packageName, reason: 'manual' },
          0,
          3,
        ),
        deps,
      ),
    ).rejects.toThrow('navigation timed out');

    expect(await ScreenshotModel.countDocuments()).toBe(0);
    const reloaded = await AppModel.findById(app._id);
    expect(reloaded?.lastCapturedAt).toBeNull();
  });

  it('on the final attempt failure: rethrows and persists a failed row with truncated error', async () => {
    const app = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
    });
    const longMessage = 'x'.repeat(2000);
    const { deps } = makeDeps({
      captureListing: vi.fn(async () => {
        throw new Error(longMessage);
      }),
    });

    await expect(
      processCaptureJob(
        makeJob(
          { appId: app._id.toString(), packageName: app.packageName, reason: 'manual' },
          2,
          3,
        ),
        deps,
      ),
    ).rejects.toThrow();

    const shots = await ScreenshotModel.find({ appId: app._id });
    expect(shots).toHaveLength(1);
    expect(shots[0]!.status).toBe('failed');
    expect(shots[0]!.error).toHaveLength(1000);
    expect(shots[0]!.imageKey).toBeNull();
  });

  it('uses a colon-and-dot-free key derived from capturedAt', async () => {
    const app = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
    });
    const { deps, put } = makeDeps();

    await processCaptureJob(
      makeJob({ appId: app._id.toString(), packageName: app.packageName, reason: 'manual' }),
      deps,
    );

    const [keyArg] = put.mock.calls[0]!;
    expect(keyArg as string).not.toMatch(/[:.](?!png$)/);
  });
});
