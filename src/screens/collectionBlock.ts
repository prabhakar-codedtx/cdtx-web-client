import type { Block, Rail } from '@/lib/api/types';

/** The grid rail a rail's list of titles is drawn in (picked in the CMS): its See all's, else the one a
 * card's `collection` tap opens. Null: the app's own grid. */
export function collectionGrid(rail: Rail): Rail | null {
  return rail.seeAll.collection ?? rail.tap.collection ?? null;
}

/** The card design a rail's list draws its titles with: the collection grid rail's, else the rail's own. */
export function collectionBlock(rail: Rail, blocks: Record<string, Block>): Block | null {
  const key = collectionGrid(rail)?.blockKey ?? rail.blockKey;
  return key ? (blocks[key] ?? null) : null;
}
