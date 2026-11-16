import type { Rail, RailChip, Title } from '@/lib/api/types';

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

/** A chip rail whose chips are its cards (`chips.display: cards`): a tile for each genre, language... */
export function isTileRail(rail: Rail): boolean {
  return rail.chips?.display === 'cards' && rail.chips.items.length > 0;
}

const TILE = 'tile:';

/** A tile as the card design reads it: the chip's label as the title, its `icon` as the picture. It is
 * no title of the catalogue: its id only names the chip (`tileKey`). */
export function tileTitle(chip: RailChip): Title {
  return {
    id: `${TILE}${chip.key}`,
    slug: null,
    type: null,
    title: chip.label,
    description: null,
    releaseYear: null,
    durationSeconds: null,
    rating: null,
    genres: [],
    languages: [],
    videoQuality: [],
    audioQuality: [],
    episodeLabel: null,
    badges: {} as Title['badges'],
    images: chip.icon ? [{ aspect: null, url: chip.icon, fallback: false }] : [],
    logoUrl: null,
    previewVideoUrl: null,
    availableUntil: null,
    entitlements: null,
  };
}

/** The chip a tile's card stands for (`tileTitle`), or null for a real title. */
export function tileKey(title: Title): string | null {
  return title.id.startsWith(TILE) ? title.id.slice(TILE.length) : null;
}

/** The list a tile opens (its `collection` tap): the tile's own titles under its label, drawn in the
 * grid the rail's tiles share (`chips.collection`), with no chips of its own. */
export function railForTile(rail: Rail, chip: RailChip): Rail {
  return {
    ...railForChip(rail, chip),
    title: chip.label,
    chips: null,
    seeAll: { ...rail.seeAll, collection: rail.chips?.collection ?? null },
    tap: { ...rail.tap, collection: null },
  };
}
