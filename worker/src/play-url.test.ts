import { describe, expect, it } from 'vitest';
import { buildCaptureUrl } from './play-url.ts';

describe('buildCaptureUrl', () => {
  it('defaults to en/US locale and country', () => {
    expect(buildCaptureUrl('com.example.app')).toBe(
      'https://play.google.com/store/apps/details?id=com.example.app&hl=en&gl=US',
    );
  });

  it('honors provided locale and country', () => {
    expect(buildCaptureUrl('com.example.app', 'de', 'DE')).toBe(
      'https://play.google.com/store/apps/details?id=com.example.app&hl=de&gl=DE',
    );
  });
});
