import mongoose from 'mongoose';
import { config } from './config.ts';
import { logger } from './logger.ts';

export async function connectDb(): Promise<void> {
  mongoose.connection.on('error', (err) => logger.error({ err }, 'mongo error'));
  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));
  await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
  logger.info('mongo connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
