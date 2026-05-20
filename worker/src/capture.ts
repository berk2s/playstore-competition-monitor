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

export interface ListingMetadata {
  title: string | null;
  developer: string | null;
  iconUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  installs: string | null;
  price: string | null;
  containsAds: boolean | null;
  inAppPurchases: boolean | null;
  updatedOn: string | null;
  version: string | null;
  size: string | null;
  minAndroid: string | null;
  whatsNew: string | null;
  shortDescription: string | null;
  longDescription: string | null;
}

export interface CaptureResult {
  buffer: Buffer;
  durationMs: number;
  metadata: ListingMetadata;
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
    const metadata = await extractListingMetadata(page);
    return { buffer, durationMs: Date.now() - started, metadata };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

async function extractListingMetadata(page: Page): Promise<ListingMetadata> {
  const empty: ListingMetadata = {
    title: null,
    developer: null,
    iconUrl: null,
    rating: null,
    ratingCount: null,
    installs: null,
    price: null,
    containsAds: null,
    inAppPurchases: null,
    updatedOn: null,
    version: null,
    size: null,
    minAndroid: null,
    whatsNew: null,
    shortDescription: null,
    longDescription: null,
  };
  try {
    const extracted = await page.evaluate(() => {
      type LD = {
        '@type'?: string | string[];
        name?: string;
        description?: string;
        image?: string;
        author?: { name?: string };
        aggregateRating?: { ratingValue?: number | string; ratingCount?: number | string };
        offers?: { price?: number | string; priceCurrency?: string };
      };

      const isAppType = (t: LD['@type']): boolean => {
        if (!t) return false;
        const arr = Array.isArray(t) ? t : [t];
        return arr.some((x) => typeof x === 'string' && /Application/i.test(x));
      };

      let ld: LD | null = null;
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          const parsed: unknown = JSON.parse(s.textContent ?? '{}');
          const arr: LD[] = Array.isArray(parsed) ? (parsed as LD[]) : [parsed as LD];
          for (const obj of arr) {
            if (isAppType(obj['@type'])) ld = obj;
          }
        } catch {
          /* ignore */
        }
      });

      const findByText = (label: string): Element | null => {
        const lower = label.toLowerCase();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let node: Node | null = walker.currentNode;
        while ((node = walker.nextNode())) {
          const el = node as Element;
          const direct = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => (n.textContent ?? '').trim())
            .join(' ')
            .trim()
            .toLowerCase();
          if (direct === lower) return el;
        }
        return null;
      };

      const valueByLabel = (label: string): string | null => {
        const el = findByText(label);
        if (!el) return null;
        const parent = el.parentElement;
        if (!parent) return null;
        for (const child of Array.from(parent.children)) {
          if (child === el) continue;
          const t = (child.textContent ?? '').trim();
          if (t) return t;
        }
        return null;
      };

      const anyTextIncludes = (needle: string): boolean => {
        const lower = needle.toLowerCase();
        return (document.body.innerText ?? '').toLowerCase().includes(lower);
      };

      const sectionContent = (heading: string): string | null => {
        const lower = heading.toLowerCase();
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
        for (const h of headings) {
          if ((h.textContent ?? '').trim().toLowerCase() === lower) {
            const container = h.closest('section, div');
            if (!container) continue;
            const text = (container.textContent ?? '').trim();
            const stripped = text.replace(new RegExp(`^${heading}\\s*`, 'i'), '').trim();
            return stripped || null;
          }
        }
        return null;
      };

      const ldObj = ld as LD | null;
      const rating =
        ldObj?.aggregateRating?.ratingValue != null
          ? Number(ldObj.aggregateRating.ratingValue)
          : null;
      const ratingCount =
        ldObj?.aggregateRating?.ratingCount != null
          ? Number(ldObj.aggregateRating.ratingCount)
          : null;

      let price: string | null = null;
      if (ldObj?.offers?.price != null) {
        const p = Number(ldObj.offers.price);
        if (Number.isFinite(p)) {
          price = p === 0 ? 'Free' : `${ldObj.offers.priceCurrency ?? ''} ${p}`.trim();
        }
      }

      return {
        title: ldObj?.name ?? document.querySelector('h1')?.textContent?.trim() ?? null,
        developer: ldObj?.author?.name ?? null,
        iconUrl: ldObj?.image ?? null,
        rating: Number.isFinite(rating) ? rating : null,
        ratingCount: Number.isFinite(ratingCount) ? ratingCount : null,
        installs: valueByLabel('Downloads'),
        price,
        containsAds: anyTextIncludes('Contains ads'),
        inAppPurchases: anyTextIncludes('In-app purchases'),
        updatedOn: valueByLabel('Updated on'),
        version: valueByLabel('Version'),
        size: valueByLabel('Downloads size') ?? valueByLabel('Size'),
        minAndroid: valueByLabel('Requires Android'),
        whatsNew: sectionContent("What's new"),
        shortDescription: null,
        longDescription: ldObj?.description ?? sectionContent('About this app'),
      };
    });
    return { ...empty, ...extracted };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'metadata extract failed');
    return empty;
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
