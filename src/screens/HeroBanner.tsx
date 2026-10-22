import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadItems } from '@/app/pagesSlice';
import type { PageRail, TitleItem } from '@/lib/api/types';
import { useElementWidth, useViewportHeight } from '@/lib/device/useElementWidth';
import { CardView } from '@/render/CardView';

/**
 * The hero banner: the rail's first slot, drawn full width. Whether it fills the screen or follows
 * its card's ratio is `presentation.fill`; the dots are `hero_layout.paging`; it turns by itself only
 * when the rail says `autoplay`, every `hero_layout.autoAdvanceSec` seconds.
 */

export function HeroBanner({
  rail,
  onOpen,
  onAction,
}: {
  rail: PageRail;
  onOpen: (item: TitleItem, rail: PageRail) => void;
  onAction: (action: string, item: TitleItem | null) => void;
}) {
  const dispatch = useAppDispatch();
  const design = rail.card_component;
  const url = rail.sources[0]?.content_url ?? '';
  const entry = useAppSelector((s) => s.pages.items[url]);
  const [ref, width] = useElementWidth<HTMLElement>();
  const viewportH = useViewportHeight();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (url) void dispatch(loadItems(url));
  }, [url, dispatch]);

  const items = entry?.status === 'ready' ? (entry.data ?? []) : [];
  const count = items.length;

  useEffect(() => {
    const sec = rail.hero_layout?.autoAdvanceSec;
    if (!rail.autoplay || !sec || count < 2) return;
    const ms = sec * 1000;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), ms);
    return () => window.clearInterval(t);
  }, [rail.autoplay, rail.hero_layout?.autoAdvanceSec, count]);

  useEffect(() => {
    if (count < 2) return;
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && e.altKey) setIndex((i) => (i + 1) % count);
      if (e.key === 'ArrowLeft' && e.altKey) setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [count]);

  if (!design) return null;
  if (entry && (entry.status === 'failed' || (entry.status === 'ready' && count === 0))) return null;

  const pres = design.presentation;
  // `fill.height: screen` is the window's height; otherwise the card keeps its own ratio.
  const height =
    pres.fill?.height === 'screen'
      ? viewportH
      : width > 0
        ? width / pres.aspectRatio
        : pres.heightPx;
  const item = items[Math.min(index, Math.max(0, count - 1))] ?? null;
  const tappable = rail.tap.card?.type && rail.tap.card.type !== 'none';

  return (
    <section ref={ref} aria-roledescription="carousel" aria-label={rail.name}>
      {width > 0 && (
        <div key={item?.id ?? 'empty'}>
          <CardView
            design={design}
            item={item}
            width={width}
            height={height}
            priority
            onOpen={tappable ? (it) => onOpen(it, rail) : undefined}
            onAction={onAction}
          />
        </div>
      )}
      {rail.hero_layout?.paging && count > 1 && (
        <div>
          {items.map((it, i) => (
            <button
              type="button"
              key={it.id}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
