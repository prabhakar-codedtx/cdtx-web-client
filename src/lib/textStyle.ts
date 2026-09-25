import type { DeliveryItem } from '@/lib/api/types';

/** The admin's own editor scaffolding for `text_style.fontSize`
 * (`frontend/src/lib/types/merchandising.ts`'s `StorefrontStyling.text`) —
 * a named 3-step scale, not a raw px value. Sized for a plain caption under
 * a rail card (~150-250px wide) — correct there, wrong everywhere else. */
const CAPTION_FONT_SIZE: Record<string, string> = {
  small: '11px',
  medium: '13px',
  large: '16px',
};

/**
 * The same 3-step keyword, resolved for a hero's title instead — fluid via
 * `vw`, same technique this file's own `Rank` used already
 * (`clamp(28px, 6vw, 64px)`), and the same technique confirmed in production
 * on a real competitor's site (`docs/references/sunnext-app-understanding.md`
 * uses `clamp()` throughout its own hero-adjacent sizing). Found live: the
 * admin's own preview burns this text at a hardcoded 13px too
 * (`storefront-container-row.tsx`'s overlay-title span) — that's fine inside
 * a small device-frame mockup, but on a real browser rendering a 1900px-wide
 * hero it reads as barely legible. There is nothing upstream to mirror for
 * this one; `text_style.fontSize` is deliberately context-free authored
 * intent (the admin has no way to know a card will land in a hero rail vs a
 * regular one), so translating "medium" into an actual size *for this
 * rendering context* is squarely this client's job, the same way `size`/
 * `aspect_ratio` become actual pixels client-side, not the backend's.
 */
const HERO_TITLE_FONT_SIZE: Record<string, string> = {
  small: 'clamp(18px, 2.4vw, 40px)',
  medium: 'clamp(22px, 3vw, 52px)',
  large: 'clamp(26px, 3.6vw, 64px)',
};

/** A hero's description line, deliberately smaller than its title (roughly
 * the same ratio the admin's own hardcoded overlay uses: 11px description
 * under a 13px title) — scaled the same fluid way. */
const HERO_DESCRIPTION_FONT_SIZE: Record<string, string> = {
  small: 'clamp(12px, 1vw, 15px)',
  medium: 'clamp(13px, 1.2vw, 18px)',
  large: 'clamp(14px, 1.4vw, 20px)',
};

/** Which text this style applies to — each has its own size scale (see the
 * tables above); `fontWeight` resolution is identical across all three. */
export type TextStyleVariant = 'caption' | 'heroTitle' | 'heroDescription';

const FONT_SIZE_SCALE: Record<TextStyleVariant, Record<string, string>> = {
  caption: CAPTION_FONT_SIZE,
  heroTitle: HERO_TITLE_FONT_SIZE,
  heroDescription: HERO_DESCRIPTION_FONT_SIZE,
};

const CSS_LENGTH = /^-?\d+(\.\d+)?(px|rem|em|%)$/;

/**
 * A card's own `text_style` is an opaque, console-authored JSONB blob with
 * no fixed schema on the wire (see `DeliveryItem.text_style`'s docstring) —
 * this resolves whatever `fontSize` it actually carries into a real CSS
 * value rather than assuming a closed enum the backend doesn't enforce. A
 * bare keyword (`small`/`medium`/`large`) maps to `scale`; anything already
 * shaped like a CSS length (`"18px"`, `"1.2rem"`) passes through as-is
 * regardless of scale — an editor who typed an exact length meant exactly
 * that, in any context; anything else is dropped rather than producing
 * invalid CSS a browser would just ignore anyway.
 */
export function resolveFontSize(
  value: string | undefined,
  scale: Record<string, string>,
): string | undefined {
  if (!value) return undefined;
  return scale[value] ?? (CSS_LENGTH.test(value) ? value : undefined);
}

/** `font-weight` accepts `normal`/`bold`/a numeric string natively — no
 * resolution needed beyond "did the editor actually set one." */
export function resolveFontWeight(value: string | undefined): string | undefined {
  return value || undefined;
}

/** `text_style`, resolved into a style object a component can spread
 * straight onto its own inline `style` — every key optional, so an unset
 * or unrecognized value falls through to that component's own CSS default
 * instead of overriding it with `undefined`. `variant` picks which of the
 * three size scales above applies; defaults to the plain rail-card caption. */
export function cardTextStyleCss(
  textStyle: DeliveryItem['text_style'],
  variant: TextStyleVariant = 'caption',
): {
  fontSize?: string;
  fontWeight?: string;
} {
  return {
    fontSize: resolveFontSize(textStyle?.fontSize, FONT_SIZE_SCALE[variant]),
    fontWeight: resolveFontWeight(textStyle?.fontWeight),
  };
}
