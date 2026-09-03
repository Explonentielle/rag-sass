import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Local file-based logging for debugging and incident tracing — no
// third-party service. Writes newline-delimited JSON, one file per day, to
// ./logs. Only works on a persistent filesystem (local dev, a VPS); on
// serverless hosting (Vercel etc.) the filesystem isn't durable between
// invocations, so this would need to move to a real log sink at that point.

const LOG_DIR = path.join(process.cwd(), 'logs');

type LogLevel = 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

async function writeToFile(line: string) {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await appendFile(path.join(LOG_DIR, `${date}.log`), line + '\n', 'utf-8');
  } catch (err) {
    // Never let a logging failure break the actual request.
    console.error('[logger] failed to write log file:', err);
  }
}

function emit(level: LogLevel, event: string, fields?: LogFields) {
  const entry = { timestamp: new Date().toISOString(), level, event, ...fields };
  const line = JSON.stringify(entry);

  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleFn(`[${entry.timestamp}] [${level}] ${event}`, fields ?? '');

  void writeToFile(line);
}

export const logInfo = (event: string, fields?: LogFields) => emit('info', event, fields);
export const logWarn = (event: string, fields?: LogFields) => emit('warn', event, fields);
export const logError = (event: string, fields?: LogFields) => emit('error', event, fields);
