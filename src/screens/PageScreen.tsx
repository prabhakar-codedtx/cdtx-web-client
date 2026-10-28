import { useEffect, useState } from 'react';
import { useAppSelector } from '@/app/hooks';
import { DETAIL_SCREEN, getDetailPage, getPage } from '@/lib/api/endpoints';
import type { Block, Page } from '@/lib/api/types';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import { useInView } from '@/lib/device/useInView';
import { fillCss, paddingCss } from '@/lib/render/paint';
import { HeroBanner } from '@/screens/HeroBanner';
import { NAV_HEIGHT } from '@/screens/navMetrics';
import { Rail } from '@/screens/Rail';
import { useTitleActions } from '@/screens/useTitleActions';

/**
 * One screen from its page JSON (`RENDERING-GUIDE.md` 3): the page's `background`, then `rails` in
 * order, the hero first (`layout: hero`), the rows `spacing.railGap` apart and `spacing.railPadding`
 * around each. A rail the server marks `visible: false` (a detail page's rail not shown for this type
 * of title, or one with nothing to show) or with `source.count` 0 is skipped: not drawn, its titles
 * not asked for. More rows (`paging.nextStart`) are asked for when the user nears the bottom.
 */
export function PageScreen({ page, contentId, screen }: { page: Page; contentId?: string; screen?: string }) {
  const { open, act, seeAll } = useTitleActions();
  const launch = useAppSelector((s) => s.launch.launch);
  // The windows of rows asked for after the first: their rails and their card designs.
  const [more, setMore] = useState<Page[]>([]);
  const [endRef, nearEnd] = useInView<HTMLDivElement>();
  const last = more[more.length - 1] ?? page;
  const nextStart = last.paging.nextStart;

  useEffect(() => {
    if (!nearEnd || nextStart === null || !launch || !page.slug) return;
    let live = true;
    const ctx = getDeliveryContext();
    // A detail screen asks its next rows the way it was opened (`detailURL`), so the same page answers.
    const next =
      screen === DETAIL_SCREEN && contentId && launch.detailURL
        ? getDetailPage(launch, contentId, undefined, ctx, { start: nextStart })
        : getPage(launch, page.slug, ctx, { contentId, start: nextStart });
    void next.then(
      (p) => {
        if (live && p) setMore((m) => [...m, p]);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [nearEnd, nextStart, launch, page.slug, contentId, screen]);

  const blocks: Record<string, Block> = Object.assign({}, page.blocks, ...more.map((p) => p.blocks));
  const rails = [...page.rails, ...more.flatMap((p) => p.rails)].filter(
    (r) => r.visible !== false && r.source.count !== 0,
  );
  const sp = page.spacing;

  return (
    // The tab bar floats over the top: a screen that opens with a hero runs under it, any other starts below it.
    <main style={{ ...fillCss(page.background), paddingTop: rails[0]?.layout === 'hero' ? 0 : NAV_HEIGHT }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp.railGap ?? 0 }}>
        {rails.map((rail) =>
          rail.layout === 'hero' ? (
            <HeroBanner key={rail.key} rail={rail} blocks={blocks} onOpen={open} onAction={act} />
          ) : (
            <div key={rail.key} style={paddingCss(sp.railPadding)}>
              <Rail
                rail={rail}
                blocks={blocks}
                onOpen={open}
                onAction={act}
                onSeeAll={(r) =>
                  seeAll(
                    r,
                    r.blockKey ? (blocks[r.blockKey] ?? null) : null,
                    page.slug,
                    page.background,
                    page.seeAllPage ?? null,
                  )
                }
              />
            </div>
          ),
        )}
      </div>
      {nextStart !== null && <div ref={endRef} aria-hidden style={{ height: 1 }} />}
    </main>
  );
}
