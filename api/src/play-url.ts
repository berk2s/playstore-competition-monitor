export interface ParsedPlayUrl {
  packageName: string;
  canonicalUrl: string;
}

export function parsePlayUrl(input: string): ParsedPlayUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!url.hostname.endsWith('play.google.com')) return null;
  if (!url.pathname.includes('/store/apps/details')) return null;
  const id = url.searchParams.get('id');
  if (!id) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(id)) return null;
  const canonicalUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`;
  return { packageName: id, canonicalUrl };
}

export function buildCaptureUrl(packageName: string, hl = 'en', gl = 'US'): string {
  const u = new URL('https://play.google.com/store/apps/details');
  u.searchParams.set('id', packageName);
  u.searchParams.set('hl', hl);
  u.searchParams.set('gl', gl);
  return u.toString();
}
