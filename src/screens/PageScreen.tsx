import { useContext, useEffect, useState } from 'react';
import { useAppSelector } from '@/app/hooks';
import { DETAIL_SCREEN, getDetailPage, getPage, getTabPage } from '@/lib/api/endpoints';
import type { Block, Page } from '@/lib/api/types';
import { DialogRoomContext } from '@/lib/device/dialogContext';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import { useInView } from '@/lib/device/useInView';
import { fillCss, paddingCss } from '@/lib/render/paint';
import { HeroBanner } from '@/screens/HeroBanner';
import { navLeftInset, navTopRoom } from '@/screens/navMetrics';
import { Rail } from '@/screens/Rail';
import { useTitleActions } from '@/screens/useTitleActions';

/**
 * One screen from its page JSON (`RENDERING-GUIDE.md` 3): the page's `background`, then `rails` in
 * order, the hero first (`layout: hero`), the rows `spacing.railGap` apart and `spacing.railPadding`
 * around each. A rail the server marks `visible: false` (a detail page's rail not shown for this type
 * of title, or one with nothing to show) or with `source.count` 0 is skipped: not drawn, its titles
 * not asked for. More rows (`paging.nextStart`) are asked for when the user nears the bottom.
 */
export function PageScreen({
  page,
  contentId,
  screen,
  dt,
}: {
  page: Page;
  contentId?: string;
  screen?: string;
  /** The device the page was asked for as: its later rows are asked for as the same one. */
  dt: string;
}) {
  const { open, act, seeAll } = useTitleActions();
  const launch = useAppSelector((s) => s.launch.launch);
  const tabs = useAppSelector((s) => s.launch.tabs);
  const navStyle = useAppSelector((s) => s.launch.navStyle);
  const topRoom = navTopRoom(navStyle);
  // The windows of rows asked for after the first: their rails and their card designs.
  const [more, setMore] = useState<Page[]>([]);
  // Page → Loading: how many rows (the hero not counted) may ask for their titles so far. It starts at
  // `railsFirst` and grows by `railsNext` as the viewer reaches the rows near the end of what is let in.
  const loading = page.loading;
  const [letIn, setLetIn] = useState(() => loading?.railsFirst ?? Infinity);
  // Whether the end of the rows is near now (not "has ever been"): once a window of rows has come and
  // pushed the end down out of reach, the next window waits until the viewer scrolls near it again.
  const [endRef, nearEnd] = useInView<HTMLDivElement>({ once: false });
  const last = more[more.length - 1] ?? page;
  const nextStart = last.paging.nextStart;

  useEffect(() => {
    if (!nearEnd || nextStart === null || !launch || !page.slug) return;
    let live = true;
    // As the device the page was opened as, whatever the window's width is now: one page, one device.
    const ctx = { ...getDeliveryContext(), dt };
    // A detail screen asks its next rows the way it was opened (`detailURL`), so the same page answers.
    const tab = page.tabId ? tabs.find((t) => t.tabId === page.tabId) : undefined;
    const next =
      screen === DETAIL_SCREEN && contentId && launch.detailURL
        ? getDetailPage(launch, contentId, undefined, ctx, { start: nextStart })
        : tab?.url
          ? getTabPage(tab.url, { start: nextStart, storefrontId: page.storefrontId })
          : getPage(launch, page.slug, ctx, { contentId, start: nextStart });
    void next.then(
      (p) => {
        // A tab swapped to another storefront meanwhile answers that one from the top: not more of this.
        if (p && page.storefrontId && p.storefrontId && p.storefrontId !== page.storefrontId) return;
        if (live && p) setMore((m) => [...m, p]);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [nearEnd, nextStart, launch, tabs, page.slug, page.tabId, page.storefrontId, contentId, screen, dt]);

  // Inside the details dialog the page is as tall as its content, not the window.
  const inDialog = useContext(DialogRoomContext) !== null;
  // A sidebar stacked on the screen: the rails start after its closed width; the hero's artwork and
  // the page's background run under it. The details dialog is drawn over the sidebar: no room there.
  const leftInset = inDialog ? 0 : navLeftInset(navStyle);
  const blocks: Record<string, Block> = Object.assign({}, page.blocks, ...more.map((p) => p.blocks));
  const rails = [...page.rails, ...more.flatMap((p) => p.rails)].filter(
    (r) => r.visible !== false && r.source.count !== 0,
  );
  const sp = page.spacing;
  // The first row of cards is on screen (or just under the hero) when the page opens: its pictures load
  // at once instead of waiting to be seen. Every other row's load as they near the screen.
  const firstRow = rails.find((r) => r.layout !== 'hero')?.key;
  // Each row's place among the rows (the hero is not a row), for the batches of Page → Loading.
  const rowIndex = new Map(rails.filter((r) => r.layout !== 'hero').map((r, i) => [r.key, i]));
  // The viewer reached row `i`: if it is within `railsNextWithin` rows of the last row let in, the next
  // `railsNext` rows are let in (more batches at once when the viewer jumped far down).
  const reached = (i: number) => {
    if (!loading) return;
    const next = Math.max(1, loading.railsNext ?? 5);
    const within = Math.max(0, loading.railsNextWithin ?? 2);
    setLetIn((n) => {
      let out = n;
      while (i >= out - 1 - within) out += next;
      return out;
    });
  };
  // A rail whose titles came back none (a library emptied since the page was asked for: the
  // page's `count` still says 1, the list fetched again after the last Remove says 0) draws nothing.
  const items = useAppSelector((s) => s.pages.items);
  const drawn = rails.filter((r) => {
    const e = r.source.contentUrl ? items[r.source.contentUrl] : undefined;
    return !(e?.status === 'ready' && (e.data?.length ?? 0) === 0);
  });
  // Nothing to draw: a library with no saved titles, or a page whose rails are all empty.
  const empty = drawn.length === 0 && nextStart === null;
  const isLibrary = page.rails.some((r) => r.source.type === 'my_list');

  return (
    // The tab bar floats over the top: a screen that opens with a hero runs under it, any other starts below it.
    // Room after the last rail, as the page says (`spacing.pageBottom`, set in the CMS).
    <main
      style={{
        ...fillCss(page.background),
        paddingTop: rails[0]?.layout === 'hero' ? 0 : topRoom,
        paddingBottom: sp.pageBottom ?? 0,
        paddingLeft: leftInset,
        // The page's background fills the whole window, however few rails or titles there are: a short page
        // (a small library, an empty one) must not end halfway down with the browser's white below it.
        minHeight: inDialog ? undefined : '100vh',
        boxSizing: 'border-box',
      }}
    >
      {empty && (
        <div role="status" style={{ padding: '48px 24px', textAlign: 'center', opacity: 0.7, fontSize: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
            {isLibrary ? 'Your list is empty' : 'Nothing here yet'}
          </div>
          {isLibrary && <div>Titles you add to your list with the + button appear here.</div>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: sp.railGap ?? 0 }}>
        {rails.map((rail) =>
          rail.layout === 'hero' ? (
            // The hero runs the full width, under the sidebar too; its banner, text and dots start at the inset.
            <div key={rail.key} style={{ marginLeft: -leftInset }}>
              <HeroBanner
                rail={rail}
                blocks={blocks}
                pageBackground={page.background}
                leftInset={leftInset}
                onOpen={open}
                onAction={act}
              />
            </div>
          ) : (
            <div key={rail.key} style={paddingCss(sp.railPadding)}>
              <Rail
                rail={rail}
                blocks={blocks}
                eager={rail.key === firstRow}
                loading={loading}
                canLoad={loading ? (rowIndex.get(rail.key) ?? 0) < letIn : undefined}
                onSeen={() => reached(rowIndex.get(rail.key) ?? 0)}
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
