import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod';
import path from 'node:path';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { appsRoutes } from './routes/apps.ts';

export async function buildServer() {
  const app = Fastify({ logger: logger as never, disableRequestLogging: false });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.CORS_ORIGIN.split(',') });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  if (config.STORAGE_DRIVER === 'local') {
    const dir = path.resolve(config.LOCAL_STORAGE_DIR);
    await app.register(fastifyStatic, {
      root: dir,
      prefix: '/screenshots/',
      decorateReply: false,
    });
  }

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async () => ({ status: 'ready' }));

  await app.register(appsRoutes, { prefix: '/api' });

  app.setErrorHandler((err, _req, reply) => {
    if ((err as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({ error: 'rate_limited', message: err.message });
    }
    if ('validation' in err && err.validation) {
      return reply.code(400).send({ error: 'validation_error', message: err.message });
    }
    logger.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'internal', message: 'Internal server error' });
  });

  return app;
}

export { jsonSchemaTransform };
