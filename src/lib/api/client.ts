import axios, { AxiosError } from 'axios';
import { profileId } from '@/lib/api/profile';
import { createLogger } from '@/lib/logger/logger';
import type { Envelope } from '@/lib/api/types';

const log = createLogger('api');

/**
 * The one axios instance every API call goes through. `baseURL` is empty by
 * default so requests stay same-origin and hit the dev server's own `/v1`
 * proxy (see vite.config.ts) — set VITE_API_URL for a build that talks to a
 * different host directly.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  // Generous on purpose: the shared Neon instance this backend points at has
  // a documented cold-path cost of several seconds per delivery call (see
  // CLAUDE.md, "Never let delivery ship the whole snapshot per request") —
  // a tight timeout here would misreport that latency as a client bug.
  timeout: 20_000,
});

/** A delivery-API failure, normalized to whatever the envelope actually said
 * rather than axios's generic "Request failed with status code 404". */
export class ApiError extends Error {
  readonly status: number | undefined;
  readonly trackingId: string | undefined;

  constructor(message: string, status: number | undefined, trackingId: string | undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.trackingId = trackingId;
  }
}

http.interceptors.request.use((config) => {
  const start = performance.now();
  // Stashed on the config so the response interceptor can compute duration
  // without a second map keyed by request — axios passes this object through.
  (config as { _startedAt?: number })._startedAt = start;
  // The viewer (Continue Watching): a header, never in the URL.
  config.headers.set('X-Profile-Id', profileId());
  log.debug(`→ ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

http.interceptors.response.use(
  (response) => {
    const startedAt = (response.config as { _startedAt?: number })._startedAt;
    const ms = startedAt ? Math.round(performance.now() - startedAt) : undefined;
    const envelope = response.data as Envelope<unknown> | undefined;
    log.debug(`← ${response.status} ${response.config.url} (${ms}ms)`, {
      trackingId: envelope?.header?.tracking_id,
    });
    return response;
  },
  (error: AxiosError<Envelope<unknown>>) => {
    const envelope = error.response?.data;
    const message = envelope?.header?.message ?? error.message;
    log.error(`✕ ${error.config?.url}`, { status: error.response?.status, message });
    return Promise.reject(new ApiError(message, error.response?.status, envelope?.header?.tracking_id));
  },
);
