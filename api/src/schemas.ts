import { z } from 'zod';

export const packageNameSchema = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/, 'Invalid Android package name');

export const playUrlSchema = z
  .string()
  .url()
  .refine((u) => u.includes('play.google.com/store/apps/details'), {
    message: 'Must be a Google Play app listing URL',
  });

export const appSchema = z.object({
  id: z.string(),
  packageName: packageNameSchema,
  playUrl: z.string().url(),
  title: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCapturedAt: z.string().nullable(),
});
export type App = z.infer<typeof appSchema>;

export const createAppInputSchema = z.object({
  playUrl: playUrlSchema,
  title: z.string().min(1).max(255).optional(),
});
export type CreateAppInput = z.infer<typeof createAppInputSchema>;

export const updateAppInputSchema = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateAppInput = z.infer<typeof updateAppInputSchema>;

export const screenshotStatusSchema = z.enum(['success', 'failed']);
export type ScreenshotStatus = z.infer<typeof screenshotStatusSchema>;

export const listingMetadataSchema = z.object({
  title: z.string().nullable(),
  developer: z.string().nullable(),
  iconUrl: z.string().nullable(),
  rating: z.number().nullable(),
  ratingCount: z.number().nullable(),
  installs: z.string().nullable(),
  price: z.string().nullable(),
  containsAds: z.boolean().nullable(),
  inAppPurchases: z.boolean().nullable(),
  updatedOn: z.string().nullable(),
  version: z.string().nullable(),
  size: z.string().nullable(),
  minAndroid: z.string().nullable(),
  whatsNew: z.string().nullable(),
  shortDescription: z.string().nullable(),
  longDescription: z.string().nullable(),
});
export type ListingMetadata = z.infer<typeof listingMetadataSchema>;

export const screenshotSchema = z.object({
  id: z.string(),
  appId: z.string(),
  status: screenshotStatusSchema,
  imageUrl: z.string().nullable(),
  imageKey: z.string().nullable(),
  capturedAt: z.string(),
  durationMs: z.number().nullable(),
  error: z.string().nullable(),
  metadata: listingMetadataSchema.nullable(),
});
export type Screenshot = z.infer<typeof screenshotSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
