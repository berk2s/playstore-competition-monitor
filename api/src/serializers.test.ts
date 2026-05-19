import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { AppModel } from './models/App.ts';
import { ScreenshotModel } from './models/Screenshot.ts';
import { serializeApp, serializeScreenshot } from './serializers.ts';

describe('serializeApp', () => {
  it('returns ISO strings and exposes id, dropping mongoose internals', () => {
    const now = new Date('2026-01-15T10:00:00.000Z');
    const doc = new AppModel({
      packageName: 'com.example.app',
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
      title: 'Example',
      active: true,
      lastCapturedAt: now,
    });
    doc.set('createdAt', now);
    doc.set('updatedAt', now);

    const out = serializeApp(doc);
    expect(out.id).toBe(doc._id.toString());
    expect(out.packageName).toBe('com.example.app');
    expect(out.title).toBe('Example');
    expect(out.active).toBe(true);
    expect(out.createdAt).toBe('2026-01-15T10:00:00.000Z');
    expect(out.lastCapturedAt).toBe('2026-01-15T10:00:00.000Z');
  });

  it('returns null for missing optional fields', () => {
    const now = new Date();
    const doc = new AppModel({
      packageName: 'com.example.minimal',
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.minimal',
    });
    doc.set('createdAt', now);
    doc.set('updatedAt', now);

    const out = serializeApp(doc);
    expect(out.title).toBeNull();
    expect(out.lastCapturedAt).toBeNull();
  });
});

describe('serializeScreenshot', () => {
  it('serializes a successful capture', () => {
    const appId = new mongoose.Types.ObjectId();
    const capturedAt = new Date('2026-01-15T10:00:00.000Z');
    const doc = new ScreenshotModel({
      appId,
      status: 'success',
      imageKey: 'shots/abc.png',
      imageUrl: 'https://cdn.example.com/shots/abc.png',
      capturedAt,
      durationMs: 1234,
    });

    const out = serializeScreenshot(doc);
    expect(out.id).toBe(doc._id.toString());
    expect(out.appId).toBe(appId.toString());
    expect(out.status).toBe('success');
    expect(out.imageKey).toBe('shots/abc.png');
    expect(out.imageUrl).toBe('https://cdn.example.com/shots/abc.png');
    expect(out.capturedAt).toBe('2026-01-15T10:00:00.000Z');
    expect(out.durationMs).toBe(1234);
    expect(out.error).toBeNull();
  });

  it('serializes a failed capture with error and null image fields', () => {
    const appId = new mongoose.Types.ObjectId();
    const doc = new ScreenshotModel({
      appId,
      status: 'failed',
      capturedAt: new Date(),
      error: 'timeout',
    });

    const out = serializeScreenshot(doc);
    expect(out.status).toBe('failed');
    expect(out.imageKey).toBeNull();
    expect(out.imageUrl).toBeNull();
    expect(out.durationMs).toBeNull();
    expect(out.error).toBe('timeout');
  });
});
