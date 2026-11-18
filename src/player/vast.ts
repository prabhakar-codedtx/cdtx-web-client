/**
 * A small VAST reader: what one ad break needs to play an ad in a `<video>`. Reads the tag's answer
 * (following wrappers), picks a file the browser can play, and keeps the tracking addresses to ping as
 * the ad plays. VAST 2 to 4, linear ads only; anything else is no ad (the video carries on).
 */

export interface VastAd {
  /** The ad's video file. */
  src: string;
  /** Seconds, as the tag says (the video's own length is used once it is loaded). */
  duration: number;
  /** Seconds after which the viewer may skip; null: not skippable. */
  skipAfter: number | null;
  clickThrough: string | null;
  impressions: string[];
  /** `start`, `firstQuartile`, `midpoint`, `thirdQuartile`, `complete`, `skip`, `mute`, `unmute`, `error`, ... */
  events: Record<string, string[]>;
  clickTracking: string[];
}

const MAX_WRAPPERS = 4;
const TIMEOUT_MS = 6000;

const text = (el: Element | null | undefined): string => (el?.textContent ?? '').trim();

/** `00:00:10` or `00:00:10.500` or `10%` of the duration: seconds (null when it cannot be told). */
function seconds(value: string | null | undefined, of?: number): number | null {
  if (!value) return null;
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
  if (pct) return of ? (Number(pct[1] ?? 0) / 100) * of : null;
  const t = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value.trim());
  if (!t) return null;
  return Number(t[1] ?? 0) * 3600 + Number(t[2] ?? 0) * 60 + Number(t[3] ?? 0) + (t[4] ? Number(`0.${t[4]}`) : 0);
}

/** The tag's macros that the player can fill. */
export function fillMacros(url: string, extra: Record<string, string> = {}): string {
  const now = String(Date.now());
  const all: Record<string, string> = {
    TIMESTAMP: new Date().toISOString(),
    CACHEBUSTING: now,
    CACHEBUSTER: now,
    RANDOM: now,
    ERRORCODE: '900',
    ...extra,
  };
  const fill = (m: string, k: string): string => {
    const v = all[k];
    return v === undefined ? m : encodeURIComponent(v);
  };
  return url
    .replace(/\[([A-Z_]+)\]/g, fill)
    .replace(/%%([A-Z_]+)%%/g, fill)
    .replace(/correlator=(?=&|$)/, `correlator=${now}`);
}

/** Tell the ad server something happened. A failure is nobody's concern. */
export function ping(url: string): void {
  try {
    const img = new Image();
    img.referrerPolicy = 'no-referrer-when-downgrade';
    img.src = fillMacros(url);
  } catch {
    // tracking is best effort
  }
}

async function fetchXml(url: string): Promise<Document> {
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(fillMacros(url), { signal: ctl.signal });
    if (!res.ok) throw new Error(`The ad tag answered ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('The ad tag did not answer VAST');
    return doc;
  } finally {
    window.clearTimeout(timer);
  }
}

const childrenOf = (el: Element, name: string): Element[] => Array.from(el.getElementsByTagName(name));

/** The browser can play it when it says so. Prefers mp4 near 720p, the smallest that is not tiny. */
function pickFile(files: Element[]): string | null {
  const probe = document.createElement('video');
  const ok = files
    .map((f) => ({
      url: text(f),
      type: f.getAttribute('type') ?? '',
      width: Number(f.getAttribute('width') ?? 0),
      delivery: f.getAttribute('delivery') ?? 'progressive',
    }))
    .filter((f) => f.url && f.delivery !== 'streaming' && probe.canPlayType(f.type) !== '');
  if (!ok.length) return null;
  ok.sort((a, b) => Math.abs(a.width - 1280) - Math.abs(b.width - 1280));
  return ok[0]?.url ?? null;
}

/** The first playable linear ad of this tag, or null when it has none. */
export async function loadVast(tagUrl: string): Promise<VastAd | null> {
  const impressions: string[] = [];
  const events: Record<string, string[]> = {};
  const clickTracking: string[] = [];
  const add = (name: string, url: string) => (events[name] ??= []).push(url);
  let url = tagUrl;
  for (let hop = 0; hop <= MAX_WRAPPERS; hop += 1) {
    const doc = await fetchXml(url);
    for (const ad of Array.from(doc.getElementsByTagName('Ad'))) {
      for (const i of childrenOf(ad, 'Impression')) impressions.push(text(i));
      for (const e of childrenOf(ad, 'Error')) add('error', text(e));
      for (const t of childrenOf(ad, 'Tracking')) {
        const name = t.getAttribute('event');
        if (name && text(t)) add(name, text(t));
      }
      for (const c of childrenOf(ad, 'ClickTracking')) if (text(c)) clickTracking.push(text(c));
    }
    const wrapper = doc.getElementsByTagName('Wrapper')[0];
    if (wrapper) {
      const next = text(wrapper.getElementsByTagName('VASTAdTagURI')[0]);
      if (!next) return null;
      url = next;
      continue;
    }
    const linear = doc.getElementsByTagName('Linear')[0];
    if (!linear) return null;
    const src = pickFile(Array.from(linear.getElementsByTagName('MediaFile')));
    if (!src) return null;
    const duration = seconds(text(linear.getElementsByTagName('Duration')[0])) ?? 0;
    return {
      src,
      duration,
      skipAfter: seconds(linear.getAttribute('skipoffset'), duration),
      clickThrough: text(linear.getElementsByTagName('ClickThrough')[0]) || null,
      impressions: impressions.filter(Boolean),
      events,
      clickTracking,
    };
  }
  return null;
}
