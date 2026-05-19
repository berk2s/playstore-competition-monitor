import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModel } from './models.ts';
import { dispatchTick, type QueueLike } from './dispatcher.ts';

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
});

function makeQueue(): QueueLike & { add: ReturnType<typeof vi.fn> } {
  return { add: vi.fn(async () => undefined) };
}

describe('dispatchTick', () => {
  it('enqueues a capture for each active app with staggered delays', async () => {
    const a = await AppModel.create({
      packageName: 'com.a.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.a.app',
    });
    const b = await AppModel.create({
      packageName: 'com.b.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.b.app',
    });
    const c = await AppModel.create({
      packageName: 'com.c.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.c.app',
    });

    const queue = makeQueue();
    const count = await dispatchTick(queue);

    expect(count).toBe(3);
    expect(queue.add).toHaveBeenCalledTimes(3);

    const calls = queue.add.mock.calls;
    const packageNames = calls.map((c) => (c[1] as { packageName: string }).packageName).sort();
    expect(packageNames).toEqual(['com.a.app', 'com.b.app', 'com.c.app']);

    const delays = calls.map((c) => (c[2] as { delay: number }).delay);
    expect(delays).toEqual([0, 2_000, 4_000]);

    for (const call of calls) {
      const [name, data, opts] = call;
      expect(name).toBe('capture');
      expect(data).toMatchObject({ reason: 'scheduled' });
      expect(opts).toMatchObject({
        attempts: expect.any(Number),
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      });
    }
    expect((calls[0]![2] as { attempts: number }).attempts).toBeGreaterThan(0);

    void a;
    void b;
    void c;
  });

  it('skips inactive apps', async () => {
    await AppModel.create({
      packageName: 'com.active.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.active.app',
      active: true,
    });
    await AppModel.create({
      packageName: 'com.inactive.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.inactive.app',
      active: false,
    });

    const queue = makeQueue();
    const count = await dispatchTick(queue);

    expect(count).toBe(1);
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect((queue.add.mock.calls[0]![1] as { packageName: string }).packageName).toBe(
      'com.active.app',
    );
  });

  it('does nothing when there are no active apps', async () => {
    const queue = makeQueue();
    const count = await dispatchTick(queue);
    expect(count).toBe(0);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
