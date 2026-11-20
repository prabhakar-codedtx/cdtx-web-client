import type { RailPopup } from '@/lib/api/types';

/** `vertical: grow`: the card grown in place by 15 % (zee5.com), so the pop-up's top edge sits this share of its own
 * height above the card's: (1 - 1 / 1.15) / 2. */
export const GROW_OVERSHOOT = (1 - 1 / 1.15) / 2;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The pop-up's size in screen px: its design width (and height when the rail sets one) times `k`, the rail's
 * card scale (drawn card width / the width its design was made at). With no height it follows the pop-up
 * design's own shape (`CLIENT-MOTION-GUIDE.md` 6b).
 */
export function popupSize(
  spec: Pick<RailPopup, 'width' | 'height'>,
  design: { width: number; height: number },
  k: number,
): { width: number; height: number } {
  const width = spec.width * k;
  const height = spec.height
    ? spec.height * k
    : design.width > 0
      ? (design.height * width) / design.width
      : width;
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Where the pop-up's top-left goes: `over` centres it on the card across, `start` lines its left edges up;
 * `top` puts its top edge on the card's top edge, `center` centres it up and down. With `edgeFlip` it is slid
 * back inside `bounds`, so a card at the edge of the row gets its pop-up pulled in, never cut off.
 */
export function popupPosition(
  card: Box,
  size: { width: number; height: number },
  bounds: Box,
  spec: Pick<RailPopup, 'anchor' | 'vertical' | 'edgeFlip'>,
): { left: number; top: number } {
  let left = spec.anchor === 'start' ? card.left : card.left + card.width / 2 - size.width / 2;
  let top =
    spec.vertical === 'grow'
      ? card.top - size.height * GROW_OVERSHOOT
      : spec.vertical === 'top'
        ? card.top
        : card.top + card.height / 2 - size.height / 2;
  if (spec.edgeFlip) {
    left = Math.max(
      bounds.left,
      Math.min(left, Math.max(bounds.left, bounds.left + bounds.width - size.width)),
    );
    top = Math.max(bounds.top, Math.min(top, Math.max(bounds.top, bounds.top + bounds.height - size.height)));
  }
  return { left, top };
}

/** The things a pop-up holds that a key can reach. */
export const FOCUSABLE = 'button, [role="button"], a[href], [tabindex="0"]';

/** Whether this screen has a pointer that can rest on a card (a touch screen has none, so it draws no pop-up). */
export const canHover = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
