import { describe, expect, it } from 'vitest';
import { parsePlayUrl, buildCaptureUrl } from './play-url.ts';

describe('parsePlayUrl', () => {
  it('extracts package name from a canonical url', () => {
    const r = parsePlayUrl(
      'https://play.google.com/store/apps/details?id=com.activision.callofduty.shooter',
    );
    expect(r?.packageName).toBe('com.activision.callofduty.shooter');
    expect(r?.canonicalUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.activision.callofduty.shooter',
    );
  });

  it('strips referral and locale query params during canonicalization', () => {
    const r = parsePlayUrl(
      'https://play.google.com/store/apps/details?id=com.example.app&referrer=utm_source%3Dfoo&hl=de',
    );
    expect(r?.canonicalUrl).toBe('https://play.google.com/store/apps/details?id=com.example.app');
  });

  it('rejects non-play urls', () => {
    expect(parsePlayUrl('https://example.com/foo')).toBeNull();
    expect(parsePlayUrl('not a url')).toBeNull();
    expect(parsePlayUrl('https://play.google.com/store/apps/details')).toBeNull();
  });

  it('rejects malformed package ids', () => {
    expect(parsePlayUrl('https://play.google.com/store/apps/details?id=nopackage')).toBeNull();
    expect(parsePlayUrl('https://play.google.com/store/apps/details?id=1bad.package')).toBeNull();
  });
});

describe('buildCaptureUrl', () => {
  it('pins locale and country', () => {
    expect(buildCaptureUrl('com.example.app')).toBe(
      'https://play.google.com/store/apps/details?id=com.example.app&hl=en&gl=US',
    );
    expect(buildCaptureUrl('com.example.app', 'de', 'DE')).toBe(
      'https://play.google.com/store/apps/details?id=com.example.app&hl=de&gl=DE',
    );
  });
});
