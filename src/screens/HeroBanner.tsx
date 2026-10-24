import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadItems } from '@/app/pagesSlice';
import type { Block, Rail, Title } from '@/lib/api/types';
import { useElementWidth, useViewportHeight } from '@/lib/device/useElementWidth';
import { imageFor } from '@/lib/render/fields';
import { CardView } from '@/render/CardView';

/**
 * The hero (`rail.layout: hero`, the page's first rail): one slide per title, drawn full width.
 * Its height is `card.stretch` (`screen`: the window's; `ratio`: from the card's own width / height);
 * the dots are `heroLayout.paging`, the thumbnails `heroLayout.thumbnail*`; it turns by itself only
 * when the rail says `autoplay`, every `heroLayout.autoAdvanceSec` seconds. Its cards are not tapped;
 * its buttons (atoms with an `action`) are.
 */
export function HeroBanner({
  rail,
  blocks,
  onOpen,
  onAction,
}: {
  rail: Rail;
  blocks: Record<string, Block>;
  onOpen: (title: Title, rail: Rail) => void;
  onAction: (action: string, title: Title | null) => void;
}) {
  const dispatch = useAppDispatch();
  const block = rail.blockKey ? (blocks[rail.blockKey] ?? null) : null;
  const url = rail.source.contentUrl ?? '';
  const hasTitles = (rail.source.count ?? 0) > 0;
  const entry = useAppSelector((s) => s.pages.items[url]);
  const [ref, width] = useElementWidth<HTMLElement>();
  const viewportH = useViewportHeight();
  const [index, setIndex] = useState(0);
  const hl = rail.heroLayout;

  useEffect(() => {
    if (url && hasTitles) void dispatch(loadItems(url));
  }, [url, hasTitles, dispatch]);

  const items = entry?.status === 'ready' ? (entry.data ?? []) : [];
  const count = items.length;

  useEffect(() => {
    const sec = hl?.autoAdvanceSec;
    if (!rail.autoplay || !sec || count < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), sec * 1000);
    return () => window.clearInterval(t);
  }, [rail.autoplay, hl?.autoAdvanceSec, count]);

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

  if (!block || !hasTitles) return null;
  if (entry && (entry.status === 'failed' || (entry.status === 'ready' && count === 0))) return null;

  const card = block.card;
  const ratio = card.width && card.height ? card.width / card.height : 16 / 9;
  // `stretch.height: screen` is the window's height; otherwise the card keeps its own shape.
  const height =
    card.stretch?.height === 'screen' ? viewportH : width > 0 ? width / ratio : (card.height ?? 0);
  const at = Math.min(index, Math.max(0, count - 1));
  const item = items[at] ?? null;
  const tappable = rail.tap.card.type !== 'none';
  // Thumbnails of the slides: `thumbnailsShown` at a time, `thumbnailWidth` wide, `thumbnailRatio` shape.
  const thumbs = hl && hl.thumbnailStyle && hl.thumbnailStyle !== 'none' && hl.thumbnailsShown ? hl : null;
  const [tw, th] = (thumbs?.thumbnailRatio ?? '').split(':').map(Number);
  const thumbRatio = tw && th ? tw / th : ratio;

  return (
    <section ref={ref} aria-roledescription="carousel" aria-label={rail.title ?? undefined}>
      {width > 0 && (
        <div key={item?.id ?? 'empty'}>
          <CardView
            block={block}
            title={item}
            width={width}
            height={height}
            priority
            onOpen={tappable ? (it) => onOpen(it, rail) : undefined}
            onAction={onAction}
          />
        </div>
      )}
      {thumbs && count > 1 && (
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {items.slice(0, Math.max(thumbs.thumbnailsShown ?? 0, 0) || count).map((it, i) => {
            const src = imageFor(it, card.imageAspect);
            return (
              <button
                type="button"
                key={it.id}
                aria-label={it.title ?? `Slide ${i + 1}`}
                aria-current={i === at}
                onClick={() => setIndex(i)}
              >
                {src && (
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    style={{
                      display: 'block',
                      width: thumbs.thumbnailWidth ?? undefined,
                      aspectRatio: thumbRatio,
                      objectFit: 'cover',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
      {hl?.paging && count > 1 && (
        <div>
          {items.map((it, i) => (
            <button
              type="button"
              key={it.id}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === at}
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
