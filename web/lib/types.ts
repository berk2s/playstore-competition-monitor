export interface App {
  id: string;
  packageName: string;
  playUrl: string;
  title: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastCapturedAt: string | null;
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

export interface Screenshot {
  id: string;
  appId: string;
  status: 'success' | 'failed';
  imageKey: string | null;
  imageUrl: string | null;
  capturedAt: string;
  durationMs: number | null;
  error: string | null;
  metadata: ListingMetadata | null;
}

export interface CreateAppInput {
  playUrl: string;
  title?: string;
}

export interface UpdateAppInput {
  title?: string | null;
  active?: boolean;
}
