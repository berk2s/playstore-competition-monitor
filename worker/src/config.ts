import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  MONGO_URI: z.string().default('mongodb://localhost:27017/playstore_competition_monitor'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CAPTURE_CRON: z.string().default('0 * * * *'),
  CAPTURE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  CAPTURE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage'),
  PUBLIC_ASSET_BASE_URL: z.string().default('http://localhost:4000/screenshots'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),

  CAPTURE_LOCALE: z.string().default('en'),
  CAPTURE_COUNTRY: z.string().default('US'),
  CAPTURE_VIEWPORT_WIDTH: z.coerce.number().int().positive().default(1280),
  CAPTURE_VIEWPORT_HEIGHT: z.coerce.number().int().positive().default(800),
  CAPTURE_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
});

export const config = configSchema.parse(process.env);
export type Config = typeof config;
