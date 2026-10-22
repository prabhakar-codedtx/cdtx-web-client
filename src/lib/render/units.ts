/** A length the design wrote: a number, "28", or "28px". Anything else (em, %, inherit) is not a length. */
export function px(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/.exec(value);
    if (m) return Number(m[1]);
  }
  return undefined;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * How much bigger or smaller than designed a card is drawn: `contentFit`. Atom lengths are drawn as
 * `px x scale x fit`, `fit` being the card's size against its designed size, between `minScale` and
 * `maxScale`. A card never grows (`maxScale` 1); a hero, which fills the screen, may (`maxScale` 2).
 */
export function fitOf(
  drawn: { width: number; height: number },
  fit: { designedWidthPx: number; designedHeightPx: number; minScale: number; maxScale: number },
): number {
  const w = fit.designedWidthPx > 0 ? drawn.width / fit.designedWidthPx : 1;
  const h = fit.designedHeightPx > 0 ? drawn.height / fit.designedHeightPx : 1;
  return clamp(Math.min(w, h), fit.minScale, fit.maxScale);
}
