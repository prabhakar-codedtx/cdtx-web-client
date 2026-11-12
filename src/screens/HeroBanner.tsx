import { useContext, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadItems } from '@/app/pagesSlice';
import type { Block, Fill, Rail, Title } from '@/lib/api/types';
import { DialogRoomContext } from '@/lib/device/dialogContext';
import { useElementWidth, useViewportHeight } from '@/lib/device/useElementWidth';
import { imageFor, imageSrc } from '@/lib/render/fields';
import { rgba } from '@/lib/render/paint';
import { CardView } from '@/render/CardView';
import { Img } from '@/render/Img';

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
  pageBackground,
  leftInset = 0,
  onOpen,
  onAction,
}: {
  rail: Rail;
  blocks: Record<string, Block>;
  /** The page's background: the backdrop fades into its colour, so no edge shows where the hero ends. */
  pageBackground?: Fill | null;
  /** Room at the left for a sidebar stacked on the screen, px: the backdrop runs under it; the banner, its arrows and dots start after it. */
  leftInset?: number;
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
  // In the details dialog a hero keeps its own shape: it is not the height of the window.
  const inDialog = useContext(DialogRoomContext) !== null;
  const [index, setIndex] = useState(0);
  const hl = rail.heroLayout;
  // The paging dots as the CMS sets them (`heroLayout.dot*`); an older answer without them keeps the look
  // the dots always had.
  const dot = {
    size: hl?.dotSize ?? 8,
    activeWidth: hl?.dotActiveWidth ?? 24,
    gap: hl?.dotGap ?? 8,
    bottom: hl?.dotBottom ?? 12,
    inset: hl?.dotInset ?? 16,
    color: hl?.dotColor ?? 'rgba(255,255,255,0.45)',
    activeColor: hl?.dotActiveColor ?? '#ffffff',
    justify: hl?.dotPosition === 'left' ? 'flex-start' : hl?.dotPosition === 'right' ? 'flex-end' : 'center',
  } as const;

  // The banner's look (`heroLayout.banner*`, `backdrop*`, `arrow*`); unset = full width, square, no backdrop.
  const inset = Math.max(0, hl?.bannerInset ?? 0);
  const radius = Math.max(0, hl?.bannerRadius ?? 0);
  const top = Math.max(0, hl?.bannerTop ?? 0);
  const bottom = Math.max(0, hl?.bannerBottom ?? 0);
  const fade = Math.max(0, hl?.backdropFade ?? 0);
  const pageColor =
    (pageBackground?.type === 'color' ? rgba(pageBackground.color) : rgba(pageBackground?.fallbackColor)) ??
    '#000000';
  // The arrows show while the pointer is over the hero (or a button in it has focus).
  const [over, setOver] = useState(false);
  const round = (hl?.arrowStyle ?? 'circle') === 'circle';
  const outside = hl?.arrowPlacement === 'outside';

  useEffect(() => {
    if (url && hasTitles) void dispatch(loadItems(url));
  }, [url, hasTitles, dispatch]);

  const items = entry?.status === 'ready' ? (entry.data ?? []) : [];
  const count = items.length;

  // Only the slide on screen is drawn. The next slide's picture is fetched ahead, quietly, so autoplay
  // or the arrow shows it at once instead of an empty banner while it loads.
  const background = block?.card.background;
  const aspect = block?.card.imageAspect ?? null;
  const loaded = entry?.status === 'ready' ? entry.data : null;
  useEffect(() => {
    const n = loaded?.length ?? 0;
    if (n < 2) return;
    const next = loaded?.[(Math.min(index, n - 1) + 1) % n] ?? null;
    const src =
      background?.type === 'image' && background.image
        ? imageSrc(background.image, next, aspect)
        : imageFor(next, aspect);
    if (!src) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }, [index, loaded, background, aspect]);

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
  // The room the banner has: the hero's width less a stacked sidebar's.
  const room = Math.max(0, width - leftInset);
  // Leave room for the margins; never narrower than a third of the screen.
  const side = Math.min(inset, Math.max(0, room / 3));
  const bannerWidth = room - 2 * side;
  const ratio = card.width && card.height ? card.width / card.height : 16 / 9;
  // `stretch.height: screen` is the window's height; otherwise the card keeps its own shape. A banner set in
  // from the screen (a space at its sides or above it) sits inside the window, so it keeps its own shape too.
  const inWindow = inset > 0 || top > 0 || bottom > 0;
  const height =
    card.stretch?.height === 'screen' && !inWindow && !inDialog
      ? viewportH
      : bannerWidth > 0
        ? bannerWidth / ratio
        : (card.height ?? 0);
  const at = Math.min(index, Math.max(0, count - 1));
  const item = items[at] ?? null;
  const tappable = rail.tap.card.type !== 'none';
  // Thumbnails of the slides: `thumbnailsShown` at a time, `thumbnailWidth` wide, `thumbnailRatio` shape.
  const thumbs = hl && hl.thumbnailStyle && hl.thumbnailStyle !== 'none' && hl.thumbnailsShown ? hl : null;
  const [tw, th] = (thumbs?.thumbnailRatio ?? '').split(':').map(Number);
  const thumbRatio = tw && th ? tw / th : ratio;
  const art = hl?.backdrop === 'blur' && item ? imageFor(item, card.imageAspect) : null;
  const go = (step: number) => setIndex((i) => (i + step + count) % count);
  const arrow = (dir: -1 | 1): React.CSSProperties => ({
    position: 'absolute',
    top: `calc(50% + ${(top - bottom) / 2}px)`,
    transform: 'translateY(-50%)',
    opacity: over ? 1 : 0,
    transition: 'opacity 0.2s ease',
    [dir < 0 ? 'left' : 'right']: (dir < 0 ? leftInset : 0) + (outside ? Math.max(0, (side - 36) / 2) : 8),
    zIndex: 2,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 0,
    padding: 0,
    color: '#fff',
    cursor: 'pointer',
    background: round ? 'rgba(0,0,0,0.6)' : 'transparent',
    borderRadius: round ? '50%' : 0,
  });

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label={rail.title ?? undefined}
      style={{ position: 'relative', overflow: 'hidden', paddingTop: top, paddingBottom: bottom }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      onFocus={() => setOver(true)}
      onBlur={() => setOver(false)}
    >
      {art && (
        // The slide's art, blurred and darkened, fills the space behind and beside the banner.
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
        >
          <Img
            src={art}
            // On screen at once, but behind the banner: fetched now, after the banner's own picture.
            priority="eager"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scale(1.25)',
              filter: `blur(${hl?.backdropBlur ?? 60}px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#000',
              opacity: (hl?.backdropDim ?? 40) / 100,
            }}
          />
          {fade > 0 && (
            // The bottom of the backdrop melts into the page's colour: no line where the hero ends.
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: fade,
                background: `linear-gradient(to bottom, transparent, ${pageColor})`,
              }}
            />
          )}
        </div>
      )}
      {width > 0 && (
        <div
          key={item?.id ?? 'empty'}
          style={{
            position: 'relative',
            marginLeft: leftInset + side,
            width: bannerWidth,
            borderRadius: radius,
            overflow: 'hidden',
          }}
        >
          <CardView
            block={block}
            title={item}
            width={bannerWidth}
            height={height}
            // What the viewer sees first: fetched ahead of every other picture on the page.
            priority="high"
            onOpen={tappable ? (it) => onOpen(it, rail) : undefined}
            onAction={onAction}
          />
        </div>
      )}
      {count > 1 && (
        <>
          <button type="button" aria-label="Previous title" onClick={() => go(-1)} style={arrow(-1)}>
            <Chevron dir={-1} size={round ? 18 : 28} />
          </button>
          <button type="button" aria-label="Next title" onClick={() => go(1)} style={arrow(1)}>
            <Chevron dir={1} size={round ? 18 : 28} />
          </button>
        </>
      )}
      {thumbs && count > 1 && (
        <div style={{ display: 'flex', overflowX: 'auto', paddingLeft: leftInset }}>
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
                  // A strip that scrolls sideways: a thumbnail loads as it nears the screen.
                  <Img
                    src={src}
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
        // Dots over the bottom of the slide: the current one is a longer pill.
        <div
          style={{
            position: 'absolute',
            left: leftInset + side,
            right: side,
            bottom: dot.bottom,
            zIndex: 2,
            display: 'flex',
            justifyContent: dot.justify,
            gap: dot.gap,
            // Room at the sides when they are not in the middle.
            paddingLeft: dot.justify === 'flex-start' ? dot.inset : 0,
            paddingRight: dot.justify === 'flex-end' ? dot.inset : 0,
            pointerEvents: 'none',
          }}
        >
          {items.map((it, i) => (
            <button
              type="button"
              key={it.id}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === at}
              onClick={() => setIndex(i)}
              style={{
                width: i === at ? dot.activeWidth : dot.size,
                height: dot.size,
                padding: 0,
                border: 0,
                borderRadius: dot.size / 2,
                background: i === at ? dot.activeColor : dot.color,
                cursor: 'pointer',
                pointerEvents: 'auto',
                transition: 'width 0.2s ease, background 0.2s ease',
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** A previous / next arrow: a plain chevron, drawn so it is the same on every system. */
function Chevron({ dir, size }: { dir: -1 | 1; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir < 0 ? 'M15 4 7 12l8 8' : 'm9 4 8 8-8 8'}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
