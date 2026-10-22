import type { ElementProps, TitleItem } from '@/lib/api/types';

/**
 * What a card part shows is named by the JSON (`bind`, `contentField`, `metaFields`): these helpers
 * only read that field off the title item. No design decision is made here.
 */

/** A field of a title as the design names it. `synopsis` is the description; `name` and `title` the title. */
export function itemField(item: TitleItem | null, key: string | null | undefined): unknown {
  if (!item || !key) return undefined;
  switch (key) {
    case 'synopsis':
    case 'description':
      return item.synopsis ?? item.description ?? null;
    case 'name':
    case 'title':
    case 'text_title':
      return item.title ?? item.name ?? item.text_title ?? null;
    default:
      return item[key];
  }
}

const present = (v: unknown): boolean =>
  v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

/** A field as text; a list is joined, a missing value is an empty string. */
export function itemText(item: TitleItem | null, key: string | null | undefined): string {
  const v = itemField(item, key);
  if (!present(v)) return '';
  return Array.isArray(v) ? v.join(', ') : String(v);
}

/** The title's picture in the aspect the design asks for (`contentImageAspect`); none, no picture. */
export function imageFor(item: TitleItem | null, aspect?: string | null): string | null {
  if (!item || !aspect) return null;
  return item.images?.find((i) => i.aspect_ratio === aspect)?.url ?? null;
}

/** A field that holds a picture address (`logo_url`, `image_title`, `thumbnail_url`). */
export function pictureField(
  item: TitleItem | null,
  key: string | null | undefined,
  aspect?: string | null,
): string | null {
  if (!item || !key) return null;
  if (key === 'thumbnail_url' || key === 'image' || key === 'images') return imageFor(item, aspect);
  const v = itemField(item, key);
  return typeof v === 'string' && v ? v : null;
}

export interface MetaSegment {
  key: string;
  value: string;
  display: 'text' | 'badge';
  color?: string;
}

/**
 * The metadata line: the fields the JSON names (`metaFields`), in that order, each written the way
 * `metaFieldModes` says (a list, a count, the first value), and left out when the title has no value.
 * A value is shown as the title item holds it: the client words and formats nothing itself.
 */
export function metaSegments(props: ElementProps, item: TitleItem | null): MetaSegment[] {
  const out: MetaSegment[] = [];
  const listSep = props.metaListSeparator ?? '';
  for (const key of props.metaFields ?? []) {
    let value: string;
    const raw = itemField(item, key);
    if (Array.isArray(raw)) {
      const mode = props.metaFieldModes?.[key] ?? 'list';
      if (raw.length === 0) value = '';
      else if (mode === 'count') value = String(raw.length);
      else if (mode === 'first') value = String(raw[0]);
      else value = raw.map(String).join(listSep);
    } else value = present(raw) ? String(raw) : '';
    if (!value) continue;
    const color = props.metaFieldColors?.[key];
    out.push({ key, value, display: props.metaFieldDisplays?.[key] ?? 'text', ...(color ? { color } : {}) });
  }
  return out;
}
