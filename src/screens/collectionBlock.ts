import type { Block, Rail } from '@/lib/api/types';

/** The card design a rail's See all grid draws its titles with: the collection grid rail's (picked in the CMS), else
 * the rail's own. */
export function collectionBlock(rail: Rail, blocks: Record<string, Block>): Block | null {
  const key = rail.seeAll.collection?.blockKey ?? rail.blockKey;
  return key ? (blocks[key] ?? null) : null;
}
