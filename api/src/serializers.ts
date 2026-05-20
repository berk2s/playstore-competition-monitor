import type { AppDoc } from './models/App.ts';
import type { ScreenshotDoc } from './models/Screenshot.ts';
import type { App, ListingMetadata, Screenshot } from './schemas.ts';

export function serializeApp(doc: AppDoc): App {
  return {
    id: doc._id.toString(),
    packageName: doc.packageName,
    playUrl: doc.playUrl,
    title: doc.title ?? null,
    active: doc.active,
    createdAt: doc.get('createdAt').toISOString(),
    updatedAt: doc.get('updatedAt').toISOString(),
    lastCapturedAt: doc.lastCapturedAt ? doc.lastCapturedAt.toISOString() : null,
  };
}

export function serializeScreenshot(doc: ScreenshotDoc): Screenshot {
  return {
    id: doc._id.toString(),
    appId: doc.appId.toString(),
    status: doc.status as 'success' | 'failed',
    imageKey: doc.imageKey ?? null,
    imageUrl: doc.imageUrl ?? null,
    capturedAt: doc.capturedAt.toISOString(),
    durationMs: doc.durationMs ?? null,
    error: doc.error ?? null,
    metadata: serializeMetadata(doc.metadata),
  };
}

function serializeMetadata(m: ScreenshotDoc['metadata']): ListingMetadata | null {
  if (!m) return null;
  return {
    title: m.title ?? null,
    developer: m.developer ?? null,
    iconUrl: m.iconUrl ?? null,
    rating: m.rating ?? null,
    ratingCount: m.ratingCount ?? null,
    installs: m.installs ?? null,
    price: m.price ?? null,
    containsAds: m.containsAds ?? null,
    inAppPurchases: m.inAppPurchases ?? null,
    updatedOn: m.updatedOn ?? null,
    version: m.version ?? null,
    size: m.size ?? null,
    minAndroid: m.minAndroid ?? null,
    whatsNew: m.whatsNew ?? null,
    shortDescription: m.shortDescription ?? null,
    longDescription: m.longDescription ?? null,
  };
}
