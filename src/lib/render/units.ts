import type { Card } from '@/lib/api/types';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * How much bigger or smaller than designed a card is drawn (`RENDERING-GUIDE.md` 5.1):
 * `clamp(min(W / card.width, H / card.height), contentFit.minScale, contentFit.maxScale)`. Every
 * length inside the card (font sizes, paddings, gaps, icon sizes, radii in units) is drawn times it.
 */
export function fitOf(drawn: { width: number; height: number }, card: Card): number {
  const w = card.width ? drawn.width / card.width : 1;
  const h = card.height ? drawn.height / card.height : 1;
  return clamp(Math.min(w, h), card.contentFit.minScale ?? 0, card.contentFit.maxScale ?? Infinity);
}
