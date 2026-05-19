import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { buildCaptureUrl } from './play-url.ts';
import { config } from './config.ts';
import { logger } from './logger.ts';

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close().catch(() => undefined);
    browserPromise = null;
  }
}

export interface CaptureResult {
  buffer: Buffer;
  durationMs: number;
}

export async function captureListing(packageName: string): Promise<CaptureResult> {
  const browser = await getBrowser();
  const ctx: BrowserContext = await browser.newContext({
    viewport: { width: config.CAPTURE_VIEWPORT_WIDTH, height: config.CAPTURE_VIEWPORT_HEIGHT },
    locale: `${config.CAPTURE_LOCALE}-${config.CAPTURE_COUNTRY}`,
    reducedMotion: 'reduce',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });

  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (
      /doubleclick|googlesyndication|google-analytics|googletagmanager|adservice/i.test(url)
    ) {
      return route.abort();
    }
    return route.continue();
  });

  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent = `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`;
    document.documentElement.appendChild(style);
  });

  const started = Date.now();
  try {
    const url = buildCaptureUrl(packageName, config.CAPTURE_LOCALE, config.CAPTURE_COUNTRY);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.CAPTURE_TIMEOUT_MS });

    await dismissConsent(page);

    await page.waitForSelector('h1', { timeout: config.CAPTURE_TIMEOUT_MS });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await page.evaluate(() => window.scrollTo(0, 0));

    const buffer = await page.screenshot({ fullPage: true, type: 'png', animations: 'disabled' });
    return { buffer, durationMs: Date.now() - started };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

async function dismissConsent(page: Page): Promise<void> {
  const buttonSelectors = [
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Reject all")',
    'form[action*="consent"] button',
  ];
  for (const sel of buttonSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => undefined);
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      logger.debug({ sel }, 'dismissed consent');
      return;
    }
  }
}
