import type { Atom, Image, MetaStyle, Title } from '@/lib/api/types';

/**
 * What a card part shows is named by the JSON (`bind`, `field`, `meta.fields`), always a key of the
 * title: these helpers only read that key off the title. No design decision is made here.
 */

const present = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

/** A key of the title as text; a list is joined, a missing value is an empty string. */
export function titleText(title: Title | null, key: string | null | undefined): string {
  if (!title || !key) return '';
  const v = title[key];
  if (!present(v)) return '';
  return Array.isArray(v) ? v.join(', ') : String(v);
}

/** The title's picture in the card's `imageAspect`, else its main picture (`aspect` null). */
export function imageFor(title: Title | null, aspect: string | null | undefined): string | null {
  if (!title) return null;
  const byAspect = aspect ? title.images.find((i) => i.aspect === aspect && i.url) : undefined;
  return byAspect?.url ?? title.images.find((i) => i.aspect === null && i.url)?.url ?? null;
}

/** An `Image`'s address: `fixed` its `url`; `content` the title key `field` names, else by aspect. */
export function imageSrc(
  img: Image | null | undefined,
  title: Title | null,
  aspect: string | null,
): string | null {
  if (!img) return null;
  if (img.source !== 'content') return img.url;
  if (img.field) {
    const v = title?.[img.field];
    return typeof v === 'string' && v ? v : null;
  }
  return imageFor(title, aspect);
}

/** The badge rule: an atom is drawn only if `showWhen` is null or the title has that badge. */
export function shown(atom: Atom, title: Title | null): boolean {
  if (!atom.showWhen) return true;
  return Boolean(title?.badges?.[atom.showWhen as keyof Title['badges']]);
}

/** Seconds as "2h 10m" (`durationSeconds` comes as a number; the app writes it). */
function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export interface MetaSegment {
  key: string;
  value: string;
  display: string;
  color?: string;
}

/**
 * The metadata line: the title keys `meta.fields` names, in that order, each written the way
 * `fieldModes` says (a list, a count, the first value), and left out when the title has no value.
 */
export function metaSegments(meta: MetaStyle, title: Title | null): MetaSegment[] {
  const out: MetaSegment[] = [];
  for (const key of meta.fields) {
    const raw = title?.[key];
    let value: string;
    if (Array.isArray(raw)) {
      const mode = meta.fieldModes[key] ?? 'list';
      if (raw.length === 0) value = '';
      else if (mode === 'count') value = String(raw.length);
      else if (mode === 'first') value = String(raw[0]);
      else value = raw.map(String).join(meta.listSeparator ?? ', ');
    } else if (key === 'durationSeconds' && typeof raw === 'number') value = duration(raw);
    else value = present(raw) ? String(raw) : '';
    if (!value) continue;
    const color = meta.fieldColors[key];
    out.push({ key, value, display: meta.fieldDisplays[key] ?? 'text', ...(color ? { color } : {}) });
  }
  return out;
}
