import { http } from '@/lib/api/client';
import { API_BASE, PRODUCT } from '@/lib/config';
import type { PlayerConfig } from '@/lib/api/player';
import type { DeliveryContext, Envelope, LaunchConfig, NavPage, Page, Theme, Title } from '@/lib/api/types';

/** What the client reads from the launch config: the addresses of the other calls and the flags. */
export interface Launch {
  pagesURL: string;
  pageURL: string;
  /** The Design System for this device, `?dt=&v=` filled in by the server; null when not sent. */
  designSystemURL: string | null;
  railItemLimit: number;
  forceUpdate: boolean;
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
  raw: Record<string, unknown>;
}

/**
 * An address from the API as a path on the API's own origin. The launch config hands out absolute
 * URLs; going through `path` keeps every call on one origin (the dev server proxies it, a build
 * sets `VITE_API_URL`), and the relative URLs of the responses (nav `url`, `contentUrl`) are used
 * as they are.
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
    params: { reg: ctx.reg, device: ctx.dt, product_id: PRODUCT },
  });
  const byKey = Object.fromEntries(data.config.map((s) => [s.key, s.value]));
  if (typeof byKey.pagesURL === 'string' && /^https?:\/\//i.test(byKey.pagesURL))
    apiOrigin = new URL(byKey.pagesURL).origin;
  const text = (key: string): string => {
    const v = byKey[key];
    if (typeof v !== 'string') throw new Error(`The launch config has no ${key}`);
    // A product the server did not fill in (it was not known) is filled in here.
    return fill(v, { product_id: PRODUCT });
  };
  return {
    pagesURL: text('pagesURL'),
    pageURL: text('pageURL'),
    designSystemURL: typeof byKey.designSystemURL === 'string' ? text('designSystemURL') : null,
    railItemLimit: typeof byKey.railItemLimit === 'number' ? byKey.railItemLimit : 10,
    forceUpdate: byKey.forceUpdate === true,
    maintenanceEnabled: byKey.maintenanceEnabled === true,
    maintenanceMessage: typeof byKey.maintenanceMessage === 'string' ? byKey.maintenanceMessage : null,
    raw: byKey,
  };
}

const THEME_KEY = 'cdtx.designSystem';

/**
 * Call 1b: the Design System (fonts, the default font) for this device. Kept by its address, which
 * carries the version `v`: a new `v` is a changed Design System and is asked for again.
 */
export async function getDesignSystem(launch: Launch, ctx: DeliveryContext): Promise<Theme | null> {
  if (!launch.designSystemURL) return null;
  const u = new URL(launch.designSystemURL, 'http://x');
  // An address without the device in it (no product was known): ask for this device.
  if (!u.searchParams.has('dt')) u.searchParams.set('dt', ctx.dt);
  const url = /^https?:\/\//i.test(launch.designSystemURL) ? u.toString() : `${u.pathname}${u.search}`;
  try {
    const kept = JSON.parse(localStorage.getItem(THEME_KEY) ?? 'null') as {
      url: string;
      theme: Theme;
    } | null;
    if (kept && kept.url === url && u.searchParams.has('v')) return kept.theme;
  } catch {
    // nothing kept, or unreadable: ask
  }
  const { data } = await http.get<Envelope<Theme>>(path(url));
  const theme = data.data[0] ?? null;
  if (theme) {
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify({ url, theme }));
    } catch {
      // storage full or blocked: it is asked for again next time
    }
  }
  return theme;
}

/** Call 2: the tabs, in order. */
export async function getTabs(launch: Launch, ctx: DeliveryContext): Promise<NavPage[]> {
  const { data } = await http.get<Envelope<NavPage>>(path(launch.pagesURL), { params: ctx });
  return data.data;
}

/** Call 3: one screen. `contentId` is the title a detail screen is opened for; `start` the next rows. */
export async function getPage(
  launch: Launch,
  slug: string,
  ctx: DeliveryContext,
  opts: { contentId?: string; start?: number } = {},
): Promise<Page> {
  const { data } = await http.get<Envelope<Page>>(path(fill(launch.pageURL, { slug })), {
    params: { ...ctx, ...opts },
  });
  const page = data.data[0];
  if (!page) throw new Error('Page not found');
  return page;
}

const PLAYER_KEY = 'cdtx.playerConfig';

/**
 * The player's address for this device: `{API host}/v1/player-config/{product}?dt={device type}`,
 * e.g. `https://3-109-241-147.sslip.io/v1/player-config/sunnxt?dt=web`. The API host is the one the
 * launch config's addresses use. A `playerConfigURL` in the launch config, when it sends one, wins.
 */
export function playerConfigUrl(launch: Launch, dt: string): string {
  const given = launch.raw.playerConfigURL;
  const base =
    typeof given === 'string'
      ? fill(given, { product_id: PRODUCT })
      : `${apiOrigin ?? ''}/v1/player-config/${encodeURIComponent(PRODUCT)}`;
  const u = new URL(base, 'http://x');
  u.searchParams.set('dt', dt);
  return /^https?:\/\//i.test(base) ? u.toString() : `${u.pathname}${u.search}`;
}

export interface PlayerConfigAnswer {
  config: PlayerConfig | null;
  /** The address asked (as `playerConfigUrl` gives it). */
  url: string;
  /** 200, 304 (the kept copy), 404 (none published), or 0 (no answer: the kept copy, if any). */
  status: number;
  trackingId: string | null;
}

/**
 * The player's layout for this device (`GET {playerConfigUrl}`). The last good copy is kept with its
 * `ETag`: it is sent back in `If-None-Match` (304: unchanged) and used when the call fails. A 404 is
 * a product with no published player: `config` null, so the app keeps its built-in player.
 */
export async function getPlayerConfig(launch: Launch, dt: string): Promise<PlayerConfigAnswer> {
  const url = playerConfigUrl(launch, dt);
  let kept: { dt: string; etag: string | null; doc: PlayerConfig } | null;
  try {
    kept = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null');
  } catch {
    kept = null;
  }
  if (kept && kept.dt !== dt) kept = null;
  try {
    // Through `path`: the same address on the API's own origin (the dev server proxies it).
    const res = await http.get<Envelope<PlayerConfig>>(path(url), {
      headers: kept?.etag ? { 'If-None-Match': kept.etag } : undefined,
      // 304 (unchanged) and 404 (none published) are answers, not failures.
      validateStatus: (s) => (s >= 200 && s < 300) || s === 304 || s === 404,
    });
    const trackingId = res.data?.header?.tracking_id ?? null;
    if (res.status === 304 && kept) return { config: kept.doc, url, status: 304, trackingId };
    if (res.status === 404) {
      localStorage.removeItem(PLAYER_KEY);
      return { config: null, url, status: 404, trackingId };
    }
    const doc = res.data.data[0] ?? null;
    if (doc) {
      const etag = (res.headers.etag as string | undefined) ?? null;
      try {
        localStorage.setItem(PLAYER_KEY, JSON.stringify({ dt, etag, doc }));
      } catch {
        // storage full or blocked: asked for in full next time
      }
    }
    return { config: doc, url, status: res.status, trackingId };
  } catch {
    // Any other failure: the last good copy, if there is one.
    return { config: kept?.doc ?? null, url, status: 0, trackingId: null };
  }
}

/** Call 4: a rail's titles. `contentUrl` is the rail's own `source.contentUrl`, called as sent. */
export async function getRailItems(contentUrl: string): Promise<Title[]> {
  const { data } = await http.get<Envelope<Title>>(path(contentUrl));
  return data.data;
}

/** One title with what the player offers for it (qualities, audio languages, subtitles, intro). */
export async function getTitle(id: string, ctx: DeliveryContext): Promise<Title | null> {
  const { data } = await http.get<Envelope<Title>>(`/v1/content/${encodeURIComponent(id)}`, { params: ctx });
  return data.data[0] ?? null;
}

/** The episodes of the season (or series) the title belongs to, in order; an episode gets its season's. */
export async function getEpisodes(id: string, ctx: DeliveryContext): Promise<Title[]> {
  const { data } = await http.get<Envelope<Title>>(`/v1/content/${encodeURIComponent(id)}/episodes`, {
    params: { ...ctx, limit: 100 },
  });
  return data.data;
}
