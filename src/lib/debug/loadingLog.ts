import { useSyncExternalStore } from 'react';

const KEY = 'cdtx.loadingDebug';

/**
 * The loading inspector is on for this tab: `?loading=debug` turns it on (it stays on as you move around
 * the app), `?loading=off` turns it off. Off by default: viewers never see it.
 */
export const loadingDebug: boolean = (() => {
  try {
    const asked = new URLSearchParams(window.location.search).get('loading');
    if (asked === 'debug') sessionStorage.setItem(KEY, '1');
    if (asked === 'off') sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export interface LoadingEvent {
  /** ms since the app started. */
  t: number;
  /** `rows`: down the page (rows let in, titles asked); `cards`: sideways windows. */
  kind: 'rows' | 'cards';
  text: string;
}

const started = performance.now();
let events: LoadingEvent[] = [];
const listeners = new Set<() => void>();

/** One line in the inspector's log (and the console): what loaded, and why. Nothing when it is off. */
export function logLoading(text: string, kind: LoadingEvent['kind'] = 'rows'): void {
  if (!loadingDebug) return;
  events = [...events.slice(-199), { t: Math.round(performance.now() - started), kind, text }];
  listeners.forEach((l) => l());
  console.info(`[loading] ${text}`);
}

export function clearLoadingLog(): void {
  events = [];
  listeners.forEach((l) => l());
}

/** The log, newest last, kept live. */
export function useLoadingLog(): LoadingEvent[] {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => events,
  );
}
