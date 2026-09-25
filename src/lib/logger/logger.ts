/**
 * App-wide logger. Two things this buys over calling `console.*` directly:
 *
 *  - a level floor: everything below `info` is dropped in production builds,
 *    so a stray `logger.debug` never ships noise to a real viewer's console.
 *  - one seam to swap consoles for a real sink later (Sentry, a beacon
 *    endpoint) without touching every call site — see `setTransport`.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

type LogTransport = (level: Level, scope: string, message: string, meta?: unknown) => void;

const LEVEL_WEIGHT: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const floor: Level = import.meta.env.DEV ? 'debug' : 'warn';

const consoleTransport: LogTransport = (level, scope, message, meta) => {
  const tag = `[${scope}]`;
  const args = meta === undefined ? [tag, message] : [tag, message, meta];
  console[level === 'debug' ? 'log' : level](...args);
};

let transport: LogTransport = consoleTransport;

/** Swap the sink — e.g. to also beacon warn/error to a monitoring endpoint. */
export function setLogTransport(next: LogTransport): void {
  transport = next;
}

function log(level: Level, scope: string, message: string, meta?: unknown): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[floor]) return;
  transport(level, scope, message, meta);
}

/** A logger tagged with a fixed scope (e.g. the module or feature name). */
export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => log('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => log('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => log('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => log('error', scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
