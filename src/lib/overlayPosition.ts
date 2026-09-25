import { css } from 'styled-components';
import type { OverlayGridPosition } from '@/lib/api/types';

/** The subset of `TitleOverlay`/`CardCta` this needs — both are "anchor at
 * one of 9 points, nudged by an inset," just for a title vs. a button, so
 * one positioning system covers both instead of two near-identical ones. */
interface Anchored {
  position: OverlayGridPosition;
  paddingPx?: number;
  insetXPx?: number;
  insetYPx?: number;
}

type GridV = 'top' | 'center' | 'bottom';
type GridH = 'left' | 'center' | 'right';

function splitPosition(position: OverlayGridPosition): { v: GridV; h: GridH } {
  if (position === 'center') return { v: 'center', h: 'center' };
  const [v, h] = position.split('-') as [GridV, GridH];
  return { v, h };
}

const DEFAULT_INSET_PX = 8;

/**
 * Flex alignment (`justify-content`/`align-items`) for one of the 9 anchor
 * points — for use on a `display: flex` slot that covers the whole card
 * (`position: absolute; inset: 0`), same technique the admin console's own
 * canvas uses (`POSITION_ALIGN_CLASS` in
 * `frontend/src/features/storefronts/storefront-container-row.tsx`).
 */
export function anchorAlignCss(position: OverlayGridPosition) {
  const { v, h } = splitPosition(position);
  const justify = h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center';
  const align = v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center';
  return css`
    justify-content: ${justify};
    align-items: ${align};
  `;
}

/**
 * The gap from whichever edge(s) `overlay.position` touches, as `padding`
 * on that flex slot — capped `min(px, capPercent%)`. Mirrors the admin
 * console's own `edgeInsetStyle`/`capPercentOfWidth`
 * (`frontend/src/features/storefronts/container-presentation.ts`) exactly,
 * including the CSS quirk it deliberately exploits: percentage padding
 * always resolves against the box's own *width*, on every side, regardless
 * of which edge it's padding — so capping a *vertical* inset by the same
 * width-relative percentage still protects a short 16:9 banner from an
 * `insetYPx`/`insetXPx` authored against a much taller/wider desktop
 * canvas.
 *
 * This exists because that admin file's own docstring documents the
 * confirmed-live incident this replicates the fix for: "Hero Spotlight"'s
 * "Watch Now"/"Trailer"/"Add To Playlist" all landing on top of each other
 * (and the title) on a narrower card, from an inset authored for a much
 * wider one and applied uncapped. The delivery API's `cta`/`title_overlay`
 * carry the exact same raw `insetXPx`/`insetYPx` values the admin's canvas
 * does, so an uncapped absolute-position implementation here would hit the
 * identical bug — and did, before this.
 */
export function anchorInsetCss(overlay: Anchored, basePx: number, capPercent: number) {
  const { v, h } = splitPosition(overlay.position);
  const insetX = overlay.insetXPx ?? overlay.paddingPx ?? basePx;
  const insetY = overlay.insetYPx ?? overlay.paddingPx ?? basePx;
  const capped = (px: number) => `min(${px}px, ${capPercent}%)`;
  return css`
    ${v === 'top' ? `padding-top: ${capped(insetY)};` : ''}
    ${v === 'bottom' ? `padding-bottom: ${capped(insetY)};` : ''}
    ${h === 'left' ? `padding-left: ${capped(insetX)};` : ''}
    ${h === 'right' ? `padding-right: ${capped(insetX)};` : ''}
  `;
}

export { DEFAULT_INSET_PX };
export type { Anchored };
