import { http } from '@/lib/api/client';
import type {
  DeliveryContext,
  DeliveryItem,
  DeliveryStorefront,
  DeliveryTab,
  Envelope,
} from '@/lib/api/types';

/** Step 1 — nav: which storefront, and its tab list (no containers yet). */
export async function getNav(ctx: DeliveryContext): Promise<DeliveryStorefront> {
  const { data } = await http.get<Envelope<DeliveryStorefront>>('/v1/storefront', { params: ctx });
  const storefront = data.data[0];
  if (!storefront) throw new Error('No storefront resolved for this region/device');
  return storefront;
}

/** Step 2 — one tab's rails (containers), each carrying a content_url instead
 * of items. `start`/`rows` page the *containers* themselves, not their
 * content — only relevant for a tab with more rows than fit on one screen. */
export async function getTab(
  storefrontId: string,
  tabId: string,
  ctx: DeliveryContext,
  start = 1,
  rows?: number,
): Promise<DeliveryTab> {
  const { data } = await http.get<Envelope<DeliveryTab>>(`/v1/storefront/${storefrontId}/tab/${tabId}`, {
    params: { ...ctx, start, rows },
  });
  const tab = data.data[0];
  if (!tab) throw new Error('Tab not found');
  return tab;
}

/** Step 3 — fill one rail. `contentUrl` already carries its own query string
 * (source_id/limit/offset/reg/...), resolved server-side per container —
 * never rebuild it client-side, just fetch it. `offset` optionally overrides
 * the embedded one, for "load more" within an already-open rail. */
export async function getRailItems(contentUrl: string, offset?: number): Promise<DeliveryItem[]> {
  const url = offset === undefined ? contentUrl : withOffset(contentUrl, offset);
  const { data } = await http.get<Envelope<DeliveryItem>>(url);
  return data.data;
}

function withOffset(url: string, offset: number): string {
  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('offset', String(offset));
  return `${path}?${params.toString()}`;
}
