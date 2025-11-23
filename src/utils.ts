import pino from 'pino';
import pretty from 'pino-pretty';

/**
 * Create logger instance
 */
export const log = pino(
  {
    level: process.env.LOCCI_DB_LOG_LEVEL || 'info',
  },
  pretty({
    colorize: true,
    singleLine: false,
    translateTime: 'SYS:standard',
  })
);

/**
 * Format bytes for human-readable output
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate port number
 */
export function isValidPort(port: number): boolean {
  return port >= 1024 && port <= 65535 && Number.isInteger(port);
}

/**
 * Validate hostname
 */
export function isValidHost(host: string): boolean {
  return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^(::)?1?$|^127\.0\.0\.1$|^localhost$|^::$/.test(
    host
  );
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
