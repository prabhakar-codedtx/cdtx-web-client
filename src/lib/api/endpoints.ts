import { http } from '@/lib/api/client';
import { API_BASE, PRODUCT } from '@/lib/config';
import type {
  DeliveryContext,
  DeliveryPage,
  Envelope,
  LaunchConfig,
  TabSummary,
  TitleItem,
} from '@/lib/api/types';

/** What the client reads from the launch config: the addresses of the other calls and the flags. */
export interface Launch {
  pagesURL: string;
  pageURL: string;
  railItemsURL: string;
  railItemLimit: number;
  forceUpdate: boolean;
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
  raw: Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An address from the API as a path on the API's own origin. The launch config hands out absolute
 * URLs; going through `path` keeps every call on one origin (the dev server proxies it, a build
 * sets `VITE_API_URL`), and `content_url`s, which are paths already, are used as they are.
 */
export function path(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url.startsWith('/') ? `${API_BASE}${url}` : url;
  const u = new URL(url);
  return `${API_BASE}${u.pathname}${u.search}`;
}

/** The origin the API's own addresses start with (read from the launch config). */
let apiOrigin: string | null = null;

/**
 * A file the API hands out (an icon): drawn through the same origin as the API's calls, so a
 * browser allows it as a mask. Anything from another host (an icon on a public CDN) is left alone.
 */
export function assetUrl(url: string): string {
  if (!apiOrigin || !/^https?:\/\//i.test(url)) return url;
  return new URL(url).origin === apiOrigin ? path(url) : url;
}

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? encodeURIComponent(values[name]!) : whole,
  );

/** Call 1: the only address the client knows. Everything below is read from its answer. */
export async function getLaunch(ctx: DeliveryContext): Promise<Launch> {
  const { data } = await http.get<LaunchConfig>('/v1/launch/config', {
    params: { reg: ctx.reg, ...(UUID.test(PRODUCT) ? { product_id: PRODUCT } : {}) },
  });
  const byKey = Object.fromEntries(data.config.map((s) => [s.key, s.value]));
  if (typeof byKey.pagesURL === 'string' && /^https?:\/\//i.test(byKey.pagesURL))
    apiOrigin = new URL(byKey.pagesURL).origin;
  const text = (key: string): string => {
    const v = byKey[key];
    if (typeof v !== 'string') throw new Error(`The launch config has no ${key}`);
    // A product given by key (not id) is filled in here; an id was filled in by the server.
    return fill(v, { product_id: PRODUCT });
  };
  return {
    pagesURL: text('pagesURL'),
    pageURL: text('pageURL'),
    railItemsURL: text('railItemsURL'),
    railItemLimit: typeof byKey.railItemLimit === 'number' ? byKey.railItemLimit : 10,
    forceUpdate: byKey.forceUpdate === true,
    maintenanceEnabled: byKey.maintenanceEnabled === true,
    maintenanceMessage: typeof byKey.maintenanceMessage === 'string' ? byKey.maintenanceMessage : null,
    raw: byKey,
  };
}

/** Call 2: the tabs, in order. */
export async function getTabs(launch: Launch, ctx: DeliveryContext): Promise<TabSummary[]> {
  const { data } = await http.get<Envelope<TabSummary>>(path(launch.pagesURL), { params: ctx });
  return data.data;
}

/** Call 3: one screen. `contentId` is the title a detail screen is opened for. */
export async function getPage(
  launch: Launch,
  slug: string,
  ctx: DeliveryContext,
  opts: { contentId?: string; start?: number; rows?: number } = {},
): Promise<DeliveryPage> {
  const { data } = await http.get<Envelope<DeliveryPage>>(path(fill(launch.pageURL, { slug })), {
    params: { ...ctx, ...opts },
  });
  const page = data.data[0];
  if (!page) throw new Error('Page not found');
  return page;
}

/** Call 4: a rail's titles. `contentUrl` is the rail's own `sources[0].content_url`, complete as sent. */
export async function getRailItems(contentUrl: string): Promise<TitleItem[]> {
  const { data } = await http.get<Envelope<TitleItem>>(path(contentUrl));
  return data.data;
}
