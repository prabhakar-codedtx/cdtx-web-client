import { ApiError } from '@/lib/api/client';

/**
 * At most `max` calls on their way at once; the rest wait their turn, first come first served. Rails
 * ask for their titles as they come near, top to bottom, so the order they wait in is the order the
 * viewer reaches them.
 */
export function limiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active < max) active += 1;
    // A finished call hands its place straight to the next one waiting (it does not free it first),
    // so a call that arrives in between cannot take it and make one more than `max`.
    else await new Promise<void>((go) => waiting.push(go));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  };
}

/**
 * Whether a failed call is worth one more try: no answer at all (offline, timed out) or the server's
 * own failure (5xx). A 4xx is the same answer however often it is asked.
 */
export function worthRetrying(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  return e.status === undefined || e.status >= 500;
}

export const wait = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));
