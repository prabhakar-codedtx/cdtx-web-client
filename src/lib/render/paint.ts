import type { CSSProperties } from 'react';
import type { Fill, Gradient, Image, Point, Shadow, Sides, Stroke, TextStyle } from '@/lib/api/types';

/**
 * The shared shapes of the JSON (`Fill`, `Gradient`, `Image`, `Stroke`, `Shadow`, `TextStyle`) as
 * CSS, the same way wherever they appear (page, rail, card, atom). Lengths are final; the ones inside
 * a card are drawn times the card's `fit` (`k`). Nothing sent, nothing set.
 */

/** `#rrggbb` / `#rrggbbaa` / `#rgb` at `opacity` (0-1), as `rgba(…)`. */
export function rgba(color: string | null | undefined, opacity = 1): string | undefined {
  if (!color) return undefined;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!m) return color;
  let hex = m[1]!;
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const n = parseInt(hex.slice(0, 6), 16);
  const a = (hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1) * opacity;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a * 1000) / 1000})`;
}

/** A `Gradient`: CSS degrees as sent (0 bottom to top, 90 left to right, 180 top to bottom). */
export function gradientCss(g: Gradient | null | undefined): string | undefined {
  if (!g || g.stops.length === 0) return undefined;
  const stops = g.stops.map((s) => `${rgba(s.color, s.opacity ?? 1)} ${(s.at ?? 0) * 100}%`);
  return `linear-gradient(${g.angle ?? 180}deg, ${stops.join(', ')})`;
}

/** `Image.fit` and `alignX` / `alignY` for an `<img>` (unknown `fit`: cover). */
export function objectFitCss(
  img: Pick<Image, 'fit' | 'alignX' | 'alignY'> | null | undefined,
): CSSProperties {
  if (!img) return {};
  const fit = img.fit === 'contain' || img.fit === 'fill' ? img.fit : 'cover';
  return { objectFit: fit, objectPosition: `${img.alignX ?? 'center'} ${img.alignY ?? 'center'}` };
}

/**
 * A `Fill` as a box's background: a colour, a gradient, or a picture over `fallbackColor` under
 * black at `scrim`. A `content` picture is the title's: the caller passes its address.
 */
export function fillCss(fill: Fill | null | undefined, contentUrl?: string | null): CSSProperties {
  if (!fill) return {};
  if (fill.type === 'color') return { backgroundColor: rgba(fill.color) };
  if (fill.type === 'gradient') return { backgroundImage: gradientCss(fill.gradient) };
  if (fill.type !== 'image' || !fill.image) return {};
  const src = fill.image.source === 'content' ? contentUrl : fill.image.url;
  const layers: string[] = [];
  if (fill.scrim) layers.push(`linear-gradient(rgba(0,0,0,${fill.scrim}), rgba(0,0,0,${fill.scrim}))`);
  if (src) layers.push(`url(${JSON.stringify(src)})`);
  const size = fill.image.fit === 'contain' ? 'contain' : fill.image.fit === 'fill' ? '100% 100%' : 'cover';
  return {
    backgroundColor: rgba(fill.fallbackColor),
    backgroundImage: layers.length ? layers.join(', ') : undefined,
    backgroundSize: size,
    backgroundPosition: `${fill.image.alignX ?? 'center'} ${fill.image.alignY ?? 'center'}`,
    backgroundRepeat: 'no-repeat',
  };
}

const SIDES = ['top', 'right', 'bottom', 'left'];

/** A `Stroke` on the sides it lists ([] = all four), `width` times `k`. */
export function strokeCss(s: Stroke | null | undefined, k = 1): CSSProperties {
  if (!s || !s.color || !s.width) return {};
  const line = `${s.width * k}px solid ${rgba(s.color)}`;
  const css: Record<string, string> = {};
  for (const side of s.sides.length ? s.sides : SIDES)
    if (SIDES.includes(side)) css[`border${side[0]!.toUpperCase()}${side.slice(1)}`] = line;
  return css as CSSProperties;
}

/** `Shadow`s as a CSS `box-shadow` (`inner` = inset), lengths times `k`. */
export function boxShadowCss(shadows: Shadow[], k = 1): string | undefined {
  if (shadows.length === 0) return undefined;
  return shadows
    .map(
      (s) =>
        `${s.type === 'inner' ? 'inset ' : ''}${(s.x ?? 0) * k}px ${(s.y ?? 0) * k}px ${(s.blur ?? 0) * k}px ${(s.spread ?? 0) * k}px ${rgba(s.color)}`,
    )
    .join(', ');
}

/** The JSON's `textCase` as CSS (`none` / null: the words as written). */
export function textTransform(textCase: string | null | undefined): CSSProperties['textTransform'] {
  return textCase === 'uppercase' || textCase === 'lowercase' || textCase === 'capitalize'
    ? textCase
    : undefined;
}

/**
 * A `TextStyle`, lengths times `k`. `fontFamily` null inherits the Design System's default font;
 * `maxLines` cuts with "…".
 */
export function textCss(t: TextStyle | null | undefined, k = 1): CSSProperties {
  if (!t) return {};
  const shadow = t.shadows.length
    ? t.shadows
        .map((s) => `${(s.x ?? 0) * k}px ${(s.y ?? 0) * k}px ${(s.blur ?? 0) * k}px ${rgba(s.color)}`)
        .join(', ')
    : undefined;
  const lines: CSSProperties = !t.maxLines
    ? {}
    : t.maxLines === 1
      ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
      : {
          display: '-webkit-box',
          WebkitLineClamp: t.maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        };
  return {
    fontFamily: t.fontFamily ?? undefined,
    fontSize: t.fontSize !== null ? t.fontSize * k : undefined,
    fontWeight: t.fontWeight ?? undefined,
    lineHeight: t.lineHeight ?? undefined,
    letterSpacing: t.letterSpacing !== null ? t.letterSpacing * k : undefined,
    color: rgba(t.color),
    textAlign: (t.align ?? undefined) as CSSProperties['textAlign'],
    textTransform: textTransform(t.textCase),
    textShadow: shadow,
    ...lines,
  };
}

/** A `Sides` as CSS padding, times `k` (null = 0). */
export function paddingCss(p: Sides | null | undefined, k = 1): CSSProperties {
  if (!p) return {};
  return {
    paddingTop: (p.top ?? 0) * k,
    paddingRight: (p.right ?? 0) * k,
    paddingBottom: (p.bottom ?? 0) * k,
    paddingLeft: (p.left ?? 0) * k,
  };
}

/** A `shapePolygon` (fractions of the box) as a CSS clip path; [] = none. */
export function polygonCss(points: Point[]): string | undefined {
  if (points.length < 3) return undefined;
  return `polygon(${points.map((p) => `${(p.x ?? 0) * 100}% ${(p.y ?? 0) * 100}%`).join(', ')})`;
}
