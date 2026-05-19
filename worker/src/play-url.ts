export function buildCaptureUrl(packageName: string, hl = 'en', gl = 'US'): string {
  const u = new URL('https://play.google.com/store/apps/details');
  u.searchParams.set('id', packageName);
  u.searchParams.set('hl', hl);
  u.searchParams.set('gl', gl);
  return u.toString();
}
