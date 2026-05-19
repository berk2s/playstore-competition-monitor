import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  MONGO_URI: z.string().default('mongodb://localhost:27017/playstore_competition_monitor'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./storage'),
  PUBLIC_ASSET_BASE_URL: z.string().default('http://localhost:4000/screenshots'),
});

export const config = configSchema.parse(process.env);
export type Config = typeof config;
