/**
 * The only settings the client brings itself: which product it shows and where the API is. Everything
 * else (addresses of the other calls, designs, sizes, texts) comes from the API's own JSON.
 */

/** The product to show: its key or id (`VITE_PRODUCT`). */
export const PRODUCT = import.meta.env.VITE_PRODUCT || 'sunnxt';

/** The API's address. Empty: same origin (the dev server proxies `/v1`). */
export const API_BASE = import.meta.env.VITE_API_URL || '';

export const REGION = import.meta.env.VITE_DEFAULT_REGION || 'in';
export const LOCALE = import.meta.env.VITE_DEFAULT_LOCALE || 'en';

/**
 * Only for an older server, without `detailURL` in its launch config: which detail page opens for
 * which kind of title (`VITE_DETAIL_PAGES` as JSON, e.g. `{"movie":"detail-movie"}`). A server with
 * `detailURL` picks the page itself from the title (`getDetailPage`), for every kind of title.
 */
export const DETAIL_PAGES: Record<string, string> = (() => {
  const fallback = {
    movie: 'detail-movie',
    series: 'detail-series-detail-page',
    season: 'detail-series-detail-page',
    episode: 'detail-episode-detail-page-roq',
  };
  try {
    return import.meta.env.VITE_DETAIL_PAGES ? JSON.parse(import.meta.env.VITE_DETAIL_PAGES) : fallback;
  } catch {
    return fallback;
  }
})();
