import { useEffect, useRef, type CSSProperties } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadItems } from '@/app/pagesSlice';
import type { PageRail, RailLayout, TitleItem } from '@/lib/api/types';
import { useElementWidth } from '@/lib/device/useElementWidth';
import { useInView } from '@/lib/device/useInView';
import { CardView } from '@/render/CardView';
import { backgroundCss } from '@/lib/render/background';

/**
 * One rail: its title, then its cards. How big the cards are and how far apart comes from
 * `rail_layout`; the cards come from the rail's own `content_url`; what a card looks like from the
 * rail's `card_component`. The client only lays them in a row.
 */

/** The size of one card: the designed or saved size, or worked out from "N cards across". */
export function cardSize(rl: RailLayout, available: number): { w: number; h: number } {
  let w: number;
  if (rl.sizing === 'count' && rl.itemsPerView) {
    const n = rl.itemsPerView;
    w = (available - rl.startPx - rl.endPx - rl.gapPx * Math.ceil(n - 1)) / n;
  } else {
    w = rl.cardWidthPx ?? 0;
  }
  // Never wider than the room there is: the card is drawn smaller, as its `contentFit` allows.
  const room = available - rl.startPx - rl.endPx;
  if (w <= 0 || (available > 0 && w > room)) w = Math.max(room, 0);
  const h =
    rl.sizing !== 'count' && rl.cardHeightPx && w === rl.cardWidthPx
      ? rl.cardHeightPx
      : w / rl.cardAspectRatio;
  return { w: Math.floor(w * 100) / 100, h: Math.floor(h * 100) / 100 };
}

export function titleCss(t: PageRail['title_style']): CSSProperties {
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    lineHeight: `${t.lineHeightPct}%`,
    letterSpacing: t.letterSpacing,
    textTransform:
      t.textCase === 'uppercase' || t.textCase === 'lowercase' || t.textCase === 'capitalize'
        ? t.textCase
        : undefined,
    color: t.color,
  };
}

export function Rail({
  rail,
  onOpen,
  onAction,
}: {
  rail: PageRail;
  onOpen: (item: TitleItem, rail: PageRail) => void;
  onAction: (action: string, item: TitleItem | null) => void;
}) {
  const dispatch = useAppDispatch();
  const source = rail.sources[0];
  const design = rail.card_component;
  const [inViewRef, inView] = useInView<HTMLElement>();
  const [widthRef, available] = useElementWidth<HTMLDivElement>();
  const rowRef = useRef<HTMLDivElement>(null);
  const url = source?.content_url ?? '';
  const entry = useAppSelector((s) => s.pages.items[url]);

  useEffect(() => {
    if (inView && url) void dispatch(loadItems(url));
  }, [inView, url, dispatch]);

  if (!design || !source) return null;
  // A rail whose titles came back empty (or failed) has nothing to draw: it takes no room.
  if (entry && (entry.status === 'failed' || (entry.status === 'ready' && (entry.data?.length ?? 0) === 0)))
    return null;

  const rl = rail.rail_layout;
  const { w, h } = cardSize(rl, available);
  const items: (TitleItem | null)[] =
    entry?.status === 'ready' && entry.data
      ? entry.data
      : Array.from({ length: source.page_size ?? 0 }, () => null);
  const grid = rail.layout === 'grid';
  const banner = rail.layout === 'banner';
  const start = rl.startPx;

  // One card (and the gap after it) at a time.
  const scroll = (dir: 1 | -1) => rowRef.current?.scrollBy({ left: dir * (w + rl.gapPx) });

  return (
    <section ref={inViewRef} aria-label={rail.name} style={backgroundCss(rail.background)}>
      <div ref={widthRef}>
        <div
          role="heading"
          aria-level={2}
          style={{ ...titleCss(rail.title_style), paddingLeft: start, paddingRight: rl.endPx }}
        >
          {rail.name}
        </div>
        {available > 0 && (
          <>
            <div
              ref={rowRef}
              style={{
                display: 'flex',
                flexWrap: grid ? 'wrap' : 'nowrap',
                columnGap: rl.gapPx,
                rowGap: rl.rowGapPx ?? rl.gapPx,
                // A rail scrolls sideways; a grid wraps.
                overflowX: grid ? undefined : 'auto',
                paddingLeft: start,
                paddingRight: rl.endPx,
              }}
            >
              {items.map((item, i) => (
                <CardView
                  key={item?.id ?? `empty-${i}`}
                  design={design}
                  item={item}
                  width={banner ? Math.max(0, available - start - rl.endPx) : w}
                  height={banner ? Math.max(0, available - start - rl.endPx) / rl.cardAspectRatio : h}
                  rank={i + 1}
                  onOpen={(it) => onOpen(it, rail)}
                  onAction={onAction}
                />
              ))}
            </div>
            {!grid && items.length > 1 && (
              <>
                <button type="button" onClick={() => scroll(-1)}>
                  Previous
                </button>
                <button type="button" onClick={() => scroll(1)}>
                  Next
                </button>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
