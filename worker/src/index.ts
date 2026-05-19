import { connectDb } from './db.ts';
import { logger } from './logger.ts';
import { startCaptureWorker } from './processor.ts';
import { startDispatcher } from './dispatcher.ts';
import { closeBrowser } from './capture.ts';

async function main() {
  await connectDb();
  const { worker, connection: workerConn } = startCaptureWorker();
  const { dispatcher, queue, connection: dispConn } = await startDispatcher();
  logger.info('worker started');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down worker');
    try {
      await worker.close();
      await dispatcher.close();
      await queue.close();
      await workerConn.quit();
      await dispConn.quit();
      await closeBrowser();
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
