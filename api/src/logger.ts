import pino from 'pino';
import { config } from './config.ts';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'api' },
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
