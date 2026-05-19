import { buildServer } from './server.ts';
import { connectDb, disconnectDb } from './db.ts';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { redis, captureQueue } from './queue.ts';

async function main() {
  await connectDb();
  const app = await buildServer();
  await app.listen({ host: '0.0.0.0', port: config.API_PORT });
  logger.info({ port: config.API_PORT }, 'api listening');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    try {
      await app.close();
      await captureQueue.close();
      await redis.quit();
      await disconnectDb();
    } catch (err) {
      logger.error({ err }, 'shutdown error');
    }
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal startup error');
  process.exit(1);
});
