import type { ContainerSize, DeliveryItemSource } from '@/lib/api/types';
import type { Breakpoint } from '@/lib/device/useBreakpoint';

/**
 * How many cards a row shows, straight from the response: `source.page_size`
 * is the backend's own "how many cards fit on screen for this device"
 * (`services/delivery.py::_page_size`) — real server-driven UI, not a
 * client guess. Card width then falls out of `100% / count`, and height
 * falls out of `aspect-ratio` (also server data) — no vh/px table on this
 * end at all.
 *
 * The fallback only fires in the case the schema documents but the seeded
 * data never hits: `page_size` is `null` when the backend couldn't resolve
 * a per-device count at all (see `DeliveryItemSource.page_size`'s docstring).
 * It exists purely so a row still renders something reasonable then, not as
 * a second source of truth to keep in sync with the backend.
 */
const FALLBACK_COUNT: Record<ContainerSize, number> = {
  regular: 5,
  large: 3,
  xlarge: 2,
};

/**
 * The server only ever resolves `page_size` for `dt=web`/`dt=androidtv`
 * (see `useBreakpoint.ts`'s docstring) — a phone or tablet browser still
 * sends `dt=web` and gets back whatever count fits a desktop row. These caps
 * only ever shrink that server-chosen count for a narrower viewport, never
 * grow it past what the server asked for — the server stays authoritative
 * for "how many fit," the client only knows "how many fit *here*."
 */
const MAX_BY_BREAKPOINT: Record<Breakpoint, Record<ContainerSize, number>> = {
  mobile: { regular: 2, large: 1, xlarge: 1 },
  tablet: { regular: 3, large: 2, xlarge: 1 },
  desktop: { regular: Infinity, large: Infinity, xlarge: Infinity },
};

export function cardsPerRow(
  source: DeliveryItemSource | undefined,
  size: ContainerSize,
  breakpoint: Breakpoint = 'desktop',
): number {
  const serverCount = source?.page_size ?? FALLBACK_COUNT[size];
  return Math.min(serverCount, MAX_BY_BREAKPOINT[breakpoint][size]);
}
