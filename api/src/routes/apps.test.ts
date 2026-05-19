import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

vi.mock('../queue.ts', () => ({
  CAPTURE_QUEUE: 'capture',
  redis: { quit: vi.fn(async () => undefined) },
  captureQueue: { close: vi.fn(async () => undefined) },
  enqueueCapture: vi.fn(async () => ({ id: 'mock-job-1' })),
}));

const { appsRoutes } = await import('./apps.ts');
const { AppModel } = await import('../models/App.ts');
const { ScreenshotModel } = await import('../models/Screenshot.ts');
const queueModule = await import('../queue.ts');

let mongo: MongoMemoryServer;
let app: FastifyInstance;

async function buildTestApp(): Promise<FastifyInstance> {
  const instance = Fastify();
  instance.setValidatorCompiler(validatorCompiler);
  instance.setSerializerCompiler(serializerCompiler);
  await instance.register(appsRoutes, { prefix: '/api' });
  await instance.ready();
  return instance;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await AppModel.deleteMany({});
  await ScreenshotModel.deleteMany({});
  vi.mocked(queueModule.enqueueCapture).mockClear();
});

const VALID_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.example.app';

describe('GET /api/apps', () => {
  it('returns an empty list when no apps exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/apps' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ apps: [] });
  });

  it('returns tracked apps sorted by createdAt desc', async () => {
    await AppModel.collection.insertOne({
      packageName: 'com.older.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.older.app',
      active: true,
      lastCapturedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    await AppModel.collection.insertOne({
      packageName: 'com.newer.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.newer.app',
      active: true,
      lastCapturedAt: null,
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    });

    const res = await app.inject({ method: 'GET', url: '/api/apps' });
    expect(res.statusCode).toBe(200);
    const { apps } = res.json() as { apps: Array<{ packageName: string }> };
    expect(apps.map((a) => a.packageName)).toEqual(['com.newer.app', 'com.older.app']);
  });
});

describe('GET /api/apps/:id', () => {
  it('returns the app when it exists', async () => {
    const doc = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
      title: 'Example',
    });
    const res = await app.inject({ method: 'GET', url: `/api/apps/${doc._id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: doc._id.toString(),
      packageName: 'com.example.app',
      title: 'Example',
      active: true,
    });
  });

  it('returns 404 for unknown id', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'GET', url: `/api/apps/${id}` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not_found', message: 'App not found' });
  });

  it('returns 400 for an invalid id format', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/apps/not-a-valid-id' });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/apps', () => {
  it('creates an app, canonicalizes the url, and enqueues a first capture', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/apps',
      payload: {
        playUrl:
          'https://play.google.com/store/apps/details?id=com.example.app&referrer=utm_source%3Dfoo',
        title: 'Example',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { id: string; packageName: string; playUrl: string };
    expect(body.packageName).toBe('com.example.app');
    expect(body.playUrl).toBe(VALID_PLAY_URL);
    expect(queueModule.enqueueCapture).toHaveBeenCalledTimes(1);
    expect(queueModule.enqueueCapture).toHaveBeenCalledWith({
      appId: body.id,
      packageName: 'com.example.app',
      reason: 'manual',
    });
  });

  it('rejects an invalid play url with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/apps',
      payload: { playUrl: 'https://example.com/not-play' },
    });
    expect(res.statusCode).toBe(400);
    expect(queueModule.enqueueCapture).not.toHaveBeenCalled();
  });

  it('returns 409 when packageName already tracked', async () => {
    await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/apps',
      payload: { playUrl: VALID_PLAY_URL },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: 'already_exists',
      message: 'This app is already being tracked',
    });
    expect(queueModule.enqueueCapture).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/apps/:id', () => {
  it('updates title and active flag', async () => {
    const doc = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
      title: 'Old',
      active: true,
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/apps/${doc._id}`,
      payload: { title: 'New', active: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: 'New', active: false });

    const reloaded = await AppModel.findById(doc._id);
    expect(reloaded?.title).toBe('New');
    expect(reloaded?.active).toBe(false);
  });

  it('returns 404 when the app does not exist', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/apps/${id}`,
      payload: { active: false },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/apps/:id', () => {
  it('removes the app and its screenshots', async () => {
    const doc = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
    });
    await ScreenshotModel.create({
      appId: doc._id,
      status: 'success',
      capturedAt: new Date(),
    });
    await ScreenshotModel.create({
      appId: doc._id,
      status: 'failed',
      capturedAt: new Date(),
      error: 'boom',
    });

    const res = await app.inject({ method: 'DELETE', url: `/api/apps/${doc._id}` });
    expect(res.statusCode).toBe(204);
    expect(await AppModel.findById(doc._id)).toBeNull();
    expect(await ScreenshotModel.countDocuments({ appId: doc._id })).toBe(0);
  });

  it('returns 404 when the app does not exist', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'DELETE', url: `/api/apps/${id}` });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/apps/:id/screenshots', () => {
  it('returns screenshots ordered by capturedAt desc, respecting limit', async () => {
    const doc = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
    });
    await ScreenshotModel.create({
      appId: doc._id,
      status: 'success',
      capturedAt: new Date('2026-01-01T00:00:00Z'),
    });
    await ScreenshotModel.create({
      appId: doc._id,
      status: 'success',
      capturedAt: new Date('2026-02-01T00:00:00Z'),
    });
    await ScreenshotModel.create({
      appId: doc._id,
      status: 'failed',
      capturedAt: new Date('2026-03-01T00:00:00Z'),
      error: 'timeout',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/apps/${doc._id}/screenshots?limit=2`,
    });
    expect(res.statusCode).toBe(200);
    const { screenshots } = res.json() as { screenshots: Array<{ capturedAt: string }> };
    expect(screenshots).toHaveLength(2);
    expect(screenshots[0].capturedAt).toBe('2026-03-01T00:00:00.000Z');
    expect(screenshots[1].capturedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('filters by status when provided', async () => {
    const doc = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
    });
    await ScreenshotModel.create({
      appId: doc._id,
      status: 'success',
      capturedAt: new Date('2026-01-01T00:00:00Z'),
    });
    await ScreenshotModel.create({
      appId: doc._id,
      status: 'failed',
      capturedAt: new Date('2026-02-01T00:00:00Z'),
      error: 'timeout',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/apps/${doc._id}/screenshots?status=failed`,
    });
    expect(res.statusCode).toBe(200);
    const { screenshots } = res.json() as { screenshots: Array<{ status: string }> };
    expect(screenshots).toHaveLength(1);
    expect(screenshots[0].status).toBe('failed');
  });

  it('returns 404 when the app does not exist', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'GET', url: `/api/apps/${id}/screenshots` });
    expect(res.statusCode).toBe(404);
  });

  it('rejects out-of-range limit with 400', async () => {
    const doc = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/apps/${doc._id}/screenshots?limit=9999`,
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/apps/:id/capture', () => {
  it('enqueues a manual capture and returns the job id', async () => {
    const doc = await AppModel.create({
      packageName: 'com.example.app',
      playUrl: VALID_PLAY_URL,
    });
    const res = await app.inject({ method: 'POST', url: `/api/apps/${doc._id}/capture` });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ enqueued: true, jobId: 'mock-job-1' });
    expect(queueModule.enqueueCapture).toHaveBeenCalledWith({
      appId: doc._id.toString(),
      packageName: 'com.example.app',
      reason: 'manual',
    });
  });

  it('returns 404 when the app does not exist', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({ method: 'POST', url: `/api/apps/${id}/capture` });
    expect(res.statusCode).toBe(404);
    expect(queueModule.enqueueCapture).not.toHaveBeenCalled();
  });
});
