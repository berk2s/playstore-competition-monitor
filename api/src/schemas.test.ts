import { describe, expect, it } from 'vitest';
import {
  packageNameSchema,
  playUrlSchema,
  createAppInputSchema,
  updateAppInputSchema,
  screenshotStatusSchema,
} from './schemas.ts';

describe('packageNameSchema', () => {
  it('accepts valid reverse-DNS ids', () => {
    expect(packageNameSchema.safeParse('com.example.app').success).toBe(true);
    expect(packageNameSchema.safeParse('com.activision.callofduty.shooter').success).toBe(true);
  });

  it('rejects single-segment or numeric-leading ids', () => {
    expect(packageNameSchema.safeParse('nopackage').success).toBe(false);
    expect(packageNameSchema.safeParse('1bad.package').success).toBe(false);
    expect(packageNameSchema.safeParse('a').success).toBe(false);
  });
});

describe('playUrlSchema', () => {
  it('accepts a valid play store listing url', () => {
    expect(
      playUrlSchema.safeParse('https://play.google.com/store/apps/details?id=com.example.app')
        .success,
    ).toBe(true);
  });

  it('rejects non-play urls', () => {
    expect(playUrlSchema.safeParse('https://example.com/foo').success).toBe(false);
    expect(playUrlSchema.safeParse('not a url').success).toBe(false);
  });
});

describe('createAppInputSchema', () => {
  it('allows title to be omitted', () => {
    const r = createAppInputSchema.safeParse({
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty title', () => {
    const r = createAppInputSchema.safeParse({
      playUrl: 'https://play.google.com/store/apps/details?id=com.example.app',
      title: '',
    });
    expect(r.success).toBe(false);
  });
});

describe('updateAppInputSchema', () => {
  it('accepts partial updates', () => {
    expect(updateAppInputSchema.safeParse({ active: false }).success).toBe(true);
    expect(updateAppInputSchema.safeParse({ title: 'New title' }).success).toBe(true);
    expect(updateAppInputSchema.safeParse({}).success).toBe(true);
  });

  it('allows title to be explicitly null', () => {
    expect(updateAppInputSchema.safeParse({ title: null }).success).toBe(true);
  });
});

describe('screenshotStatusSchema', () => {
  it('accepts success and failed', () => {
    expect(screenshotStatusSchema.safeParse('success').success).toBe(true);
    expect(screenshotStatusSchema.safeParse('failed').success).toBe(true);
  });

  it('rejects other values', () => {
    expect(screenshotStatusSchema.safeParse('pending').success).toBe(false);
  });
});
