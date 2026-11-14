import type { Rail, RailChip } from '@/lib/api/types';

/**
 * A chip rail (`CMS docs/client-contract/FILTERED-RAILS.md`): which chip's titles are shown, and the
 * rail as that chip sees it. The row itself is `screens/ChipRow.tsx`.
 */

/** The chip whose titles are shown: the one picked, else the server's `default`, else the first. */
export function shownChip(rail: Rail, picked: string | null): RailChip | null {
  const items = rail.chips?.items ?? [];
  return (
    items.find((c) => c.key === picked) ??
    items.find((c) => c.key === rail.chips?.default) ??
    items[0] ??
    null
  );
}

/** The rail as the picked chip sees it: that chip's titles (`contentUrl`, `count`) in place of the
 * rail's own, so loading, "See all" and its count all follow the chip. Any other rail: as it is. */
export function railForChip(rail: Rail, chip: RailChip | null): Rail {
  if (!chip) return rail;
  return {
    ...rail,
    source: { ...rail.source, contentUrl: chip.contentUrl, count: chip.count ?? rail.source.count },
  };
}
