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

export const screenshotSchema = z.object({
  id: z.string(),
  appId: z.string(),
  status: screenshotStatusSchema,
  imageUrl: z.string().nullable(),
  imageKey: z.string().nullable(),
  capturedAt: z.string(),
  durationMs: z.number().nullable(),
  error: z.string().nullable(),
});
export type Screenshot = z.infer<typeof screenshotSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
