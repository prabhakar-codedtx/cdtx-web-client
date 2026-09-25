import type { DeliveryContext } from '@/lib/api/types';

/**
 * Heuristic Android TV detection. There is no single official UA marker
 * across vendors, but "Android" + a TV-shaped Chrome build reliably includes
 * one of these tokens (Google/AOSP TV, Fire TV, or Chromecast-with-Google-TV
 * WebView). False negatives just fall back to "web", which is safe — the
 * storefront still renders, only the remote-friendly chrome is skipped.
 */
function isAndroidTv(userAgent: string): boolean {
  return /Android/.test(userAgent) && /(AFT[A-Z]|GoogleTV|Android TV)/.test(userAgent);
}

/**
 * The delivery API's request context. `dt` is deliberately only ever "web"
 * or "androidtv" — the seeded storefront's `device_types` only recognizes
 * those two (confirmed against the running backend: `dt=tablet`/`mobile`/
 * `tv` all 404 at storefront resolution). Tablet/mobile/desktop layout
 * differences are handled entirely client-side via `useBreakpoint`, not by
 * asking the server for a bucket it doesn't have.
 */
export function getDeliveryContext(): DeliveryContext {
  return {
    reg: import.meta.env.VITE_DEFAULT_REGION || 'ph',
    locale: import.meta.env.VITE_DEFAULT_LOCALE || 'en',
    dt: isAndroidTv(navigator.userAgent) ? 'androidtv' : 'web',
  };
}
