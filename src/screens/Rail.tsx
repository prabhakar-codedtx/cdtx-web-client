import { useEffect, useRef, type CSSProperties } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { isViewerRail, loadItems, refreshItems } from '@/app/pagesSlice';
import type { Atom, Block, Rail as RailJson, RailLayout, Title } from '@/lib/api/types';
import { useElementWidth } from '@/lib/device/useElementWidth';
import { useInView } from '@/lib/device/useInView';
import { CardView } from '@/render/CardView';
import { AtomView, type PartCtx } from '@/render/Parts';
import { fillCss, paddingCss, textCss } from '@/lib/render/paint';

/**
 * One rail (`RENDERING-GUIDE.md` 4): its `background`, its heading (`title` in `titleStyle`), the
 * header design, the cards, the footer design. What a card looks like is `blocks[rail.blockKey]`; its
 * titles come from `source.contentUrl`, asked when the rail nears the screen; its size and the gaps
 * from `railLayout`. The client only lays them out as `layout` says.
 */

/**
 * The size of one card in this rail (`RENDERING-GUIDE.md` 4.1). `lane` is the width the cards have
 * (after the rail's `bodyPadding`); `n` the number of titles (a banner fits them all across).
 */
export function cardSize(
  rl: RailLayout,
  block: Block,
  layout: string,
  lane: number,
  n: number,
): { w: number; h: number } {
  const start = rl.start ?? 0;
  const end = rl.end ?? 0;
  const gap = rl.gap ?? 0;
  const { width: cw, height: ch } = block.card;
  const ratio = rl.cardAspectRatio ?? (cw && ch ? cw / ch : 1);
  let w: number;
  let h: number;
  if (rl.cardWidth !== null) {
    // The rail resized the card (`exact` or `tier`).
    w = rl.cardWidth;
    h = rl.cardHeight ?? w / ratio;
  } else if (rl.mode === 'count' && rl.itemsPerView) {
    // "N cards across" (N may be 4.5: the next card peeks in).
    const per = rl.itemsPerView;
    w = (lane - start - end - gap * Math.ceil(per - 1)) / per;
    h = w / ratio;
  } else if (layout === 'banner') {
    const count = Math.max(1, n);
    w = (lane - start - end - gap * (count - 1)) / count;
    h = w / ratio;
  } else {
    // As designed.
    w = cw ?? 0;
    h = ch ?? 0;
  }
  // Never wider than the room there is: the card is drawn smaller, as its `contentFit` allows.
  const room = lane - start - end;
  if (room > 0 && w > room) {
    h = (h * room) / w;
    w = room;
  }
  return { w: Math.max(0, Math.floor(w * 100) / 100), h: Math.max(0, Math.floor(h * 100) / 100) };
}

/** An atom with the rail's own words in place of its text layer's, when the rail has some. */
function withLabel(atom: Atom, label: string | null): Atom {
  if (!label) return atom;
  return {
    ...atom,
    style: {
      ...atom.style,
      layers: atom.style.layers.map((l) => (l.type === 'text' ? { ...l, staticText: label, bind: null } : l)),
    },
  };
}

/** The link as just its arrow: the design's own icon when it has one (the words go), else a `›`. */
function arrowOnly(atom: Atom): Atom {
  if (!atom.style.layers.some((l) => l.type === 'icon')) return withLabel(atom, '›');
  return { ...atom, style: { ...atom.style, layers: atom.style.layers.filter((l) => l.type !== 'text') } };
}

/**
 * A rail's "See all" link when no header design draws it: its words (`label`, with the count unless the
 * editor turned it off), as a text link (`label ›`), a button, or just an arrow, in the editor's text style
 * and colour; the rail title's colour when it has none.
 */
function seeAllLink(rail: RailJson, titleColor: string | null): { text: string; style: CSSProperties } {
  const sa = rail.seeAll;
  const style = sa.style ?? 'text';
  const count = rail.source.count;
  const label = sa.label ?? 'See all';
  const words = sa.showCount === false || !count ? label : `${label} (${count})`;
  const text = style === 'arrow' ? '›' : style === 'button' ? words : `${words} ›`;
  const ink = sa.text?.color ?? titleColor ?? undefined;
  return {
    text,
    style: {
      ...textCss(sa.text),
      color: ink,
      background: 'none',
      border: style === 'button' ? `1px solid ${ink ?? 'currentColor'}` : 'none',
      borderRadius: style === 'button' ? 999 : undefined,
      padding: style === 'button' ? '4px 14px' : 0,
      cursor: 'pointer',
      font: sa.text ? undefined : 'inherit',
    },
  };
}

/**
 * The "View all" card at the end of a row, as big as the row's cards: its own design from the CMS
 * (`seeAll.endCardBlockKey`, a Content Block of card type "View all card") when the rail picked one,
 * else a plain card with its words in the middle and an arrow.
 */
function EndCard({
  rail,
  design,
  width,
  height,
  onOpen,
}: {
  rail: RailJson;
  design: Block | null;
  width: number;
  height: number;
  onOpen: () => void;
}) {
  const sa = rail.seeAll;
  if (design) {
    return (
      <div
        role="button"
        tabIndex={0}
        data-end-card="design"
        aria-label={sa.endCardLabel || 'View all'}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        style={{ flex: '0 0 auto', width, height, cursor: 'pointer' }}
      >
        {/* No title: the design shows its own words and icon. */}
        <CardView block={design} title={null} width={width} height={height} standalone />
      </div>
    );
  }
  const ink = sa.text?.color ?? '#ffffff';
  return (
    <button
      type="button"
      data-end-card
      onClick={onOpen}
      aria-label={sa.endCardLabel || 'View all'}
      style={{
        flex: '0 0 auto',
        width,
        height,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 12,
        border: '1px solid rgba(255,255,255,0.28)',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.08)',
        color: ink,
        cursor: 'pointer',
        fontFamily: sa.text?.fontFamily ?? 'inherit',
        fontWeight: sa.text?.fontWeight ?? 700,
        fontSize: sa.text?.fontSize ?? 15,
        textTransform: sa.text?.textCase === 'uppercase' ? 'uppercase' : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `1.5px solid ${ink}`,
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        ›
      </span>
      {sa.endCardLabel || 'View all'}
    </button>
  );
}

export function Rail({
  rail,
  blocks,
  onOpen,
  onAction,
  onSeeAll,
}: {
  rail: RailJson;
  blocks: Record<string, Block>;
  onOpen: (title: Title, rail: RailJson) => void;
  onAction: (action: string, title: Title | null) => void;
  onSeeAll: (rail: RailJson) => void;
}) {
  const dispatch = useAppDispatch();
  const block = rail.blockKey ? (blocks[rail.blockKey] ?? null) : null;
  const header = rail.headerKey ? (blocks[rail.headerKey] ?? null) : null;
  const footer = rail.footerKey ? (blocks[rail.footerKey] ?? null) : null;
  const [inViewRef, inView] = useInView<HTMLElement>();
  const [widthRef, available] = useElementWidth<HTMLDivElement>();
  const rowRef = useRef<HTMLDivElement>(null);
  const url = rail.source.contentUrl ?? '';
  const hasTitles = (rail.source.count ?? 0) > 0;
  const entry = useAppSelector((s) => s.pages.items[url]);
  // No titles held: never asked, or dropped since (the viewer's own rails, after they watched).
  const missing = !entry;

  // The viewer's own rails (My list, Continue Watching) are asked for again each time their screen is
  // shown, at once (not when in view): what was loaded before may be out of date, and an empty list
  // kept from before draws nothing, so it would never come into view to be asked again. The titles
  // already there stay on screen until the new ones come. Any other rail is asked once, when near.
  const viewer = isViewerRail(rail);
  const refreshed = useRef(false);
  useEffect(() => {
    if (inView && url && hasTitles && missing) void dispatch(loadItems(url));
  }, [inView, url, hasTitles, missing, dispatch]);
    if (!url || !hasTitles) return;
    if (viewer && entry && !refreshed.current) {
      refreshed.current = true;
      void dispatch(refreshItems(url));
      return;
    }
    if (inView) void dispatch(loadItems(url));
    // `entry` only decides whether there is something to refresh; a change to it must not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, url, hasTitles, viewer, dispatch]);

  // Nothing to show (`count` 0, no design), or titles that came back empty or failed: no room taken.
  if (!hasTitles || !block) return null;
  if (entry && (entry.status === 'failed' || (entry.status === 'ready' && (entry.data?.length ?? 0) === 0)))
    return null;

  const rl = rail.railLayout;
  const body = rl.bodyPadding;
  const lane = Math.max(0, available - (body?.left ?? 0) - (body?.right ?? 0));
  const loaded = entry?.status === 'ready' && entry.data ? entry.data : null;
  let items: (Title | null)[] = loaded ?? Array.from({ length: rail.source.pageSize ?? 0 }, () => null);
  // An unknown layout is drawn as a carousel.
  const layout = rail.layout === 'banner' || rail.layout === 'grid' ? rail.layout : 'carousel';
  const { w, h } = cardSize(rl, block, layout, lane, items.length);
  const gap = rl.gap ?? 0;
  // The space the editor set between the title (or a header design) and the cards.
  const headerGap = rl.headerGap ?? 0;
  const start = rl.start ?? 0;
  const end = rl.end ?? 0;
  const vertical = layout === 'carousel' && rl.direction === 'vertical';
  // A grid stops after `grid.maxRows` rows.
  if (layout === 'grid' && rail.grid?.maxRows && w > 0) {
    const cols = Math.max(1, Math.floor((lane - start - end + gap) / (w + gap)));
    items = items.slice(0, cols * rail.grid.maxRows);
  }
  const scrolls = layout === 'carousel' && !vertical;
  // TV: free room around the cards for the focus look (a focused card grows and glows).
  const inset = rl.focusInset;
  const t = rail.titleStyle;
  const tappable = rail.tap.card.type !== 'none' || Object.keys(rail.tap.cards).length > 0;

  // A header or footer that is a strip (`card.display: "strip"`): as wide as the lane and as high as its
  // content, its parts laid out as `card.strip` says. A text bound to `railTitle` is the rail's title.
  const stripCtx: PartCtx = {
    title: null,
    fit: 1,
    cardW: lane,
    aspect: null,
    railTitle: rail.title,
    onAction: (action) => {
      if (action === 'see_all') onSeeAll(rail);
    },
  };
  // "See all" as an arrow only (`seeAll.style: arrow`): the header design's link is a chevron right after
  // the title, and the title and chevron are one link to the rail's titles.
  const arrowOnlyLink = rail.seeAll.show && rail.seeAll.style === 'arrow';
  const strip = (b: Block) => {
    const s = b.card.strip;
    const along: Record<string, string> = {
      start: 'flex-start',
      center: 'center',
      end: 'flex-end',
      between: 'space-between',
    };
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: s?.direction === 'column' ? 'column' : 'row',
          alignItems: along[s?.align ?? ''] ?? 'center',
          justifyContent: arrowOnlyLink ? 'flex-start' : (along[s?.distribute ?? ''] ?? 'flex-start'),
          gap: arrowOnlyLink ? 6 : (s?.gap ?? undefined),
          padding: `${s?.paddingY ?? 0}px ${s?.paddingX ?? 0}px`,
          width: lane,
          boxSizing: 'border-box',
        }}
      >
        {b.atoms
          // The header is one design shared by rails: its "See all" link is drawn only on a rail that
          // has one (`seeAll.show`), and in that rail's own words (`seeAll.label`).
          .filter((a) => a.action !== 'see_all' || rail.seeAll.show)
          .map((a) => (
            <span
              key={a.id}
              onClick={arrowOnlyLink ? () => onSeeAll(rail) : undefined}
              style={arrowOnlyLink ? { display: 'contents', cursor: 'pointer' } : { display: 'contents' }}
            >
              <AtomView
                atom={
                  a.action === 'see_all' ? (arrowOnlyLink ? arrowOnly(a) : withLabel(a, rail.seeAll.label)) : a
                }
                ctx={stripCtx}
                inFrame={false}
              />
            </span>
          ))}
      </div>
    );
  };
  // Otherwise a header or footer design spans the lane, at its own shape. One that places nothing on its
  // card (its atoms and components have no frame) has nothing to draw, so it takes no room: sized by its
  // card's shape it would be an empty box as tall as the lane is wide.
  const spanning = (b: Block) =>
    b.card.display === 'strip' ? (
      strip(b)
    ) : b.atoms.some((a) => a.frame) || b.components.some((c) => c.slot === 'card' && c.frame) ? (
      <CardView
        block={b}
        title={null}
        width={lane}
        height={b.card.width && b.card.height ? (lane * b.card.height) / b.card.width : 0}
        standalone
      />
    ) : null;

  const headerNode = header ? spanning(header) : null;

  // The link beside the title, as the rail's `seeAll` says, unless a header or footer design draws it.
  const sa = rail.seeAll;
  const designDraws = [header, footer].some(
    (b) =>
      b &&
      (b.atoms.some((a) => a.action === 'see_all') ||
        b.components.some((c) => c.atoms.some((a) => a.action === 'see_all'))),
  );
  const link = sa.show && sa.label && !designDraws ? seeAllLink(rail, t.color) : null;
  // An arrow-only link sits right after the title, which is a link too (a chevron beside the heading);
  // any other style is at the left or right end of the title row.
  const inlineArrow = !!link && sa.style === 'arrow';
  const linkLeft = !inlineArrow && sa.position === 'left';

  return (
    <section ref={inViewRef} aria-label={rail.title ?? undefined} style={fillCss(rail.background)}>
      <div ref={widthRef}>
        {(!t.hidden && rail.title) || link ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: inlineArrow ? 6 : 12,
              paddingLeft: start,
              paddingRight: end,
              marginBottom: headerGap,
            }}
          >
            {linkLeft && link && (
              <button type="button" onClick={() => onSeeAll(rail)} style={link.style}>
                {link.text}
              </button>
            )}
            <div
              role="heading"
              aria-level={2}
              onClick={inlineArrow ? () => onSeeAll(rail) : undefined}
              style={{
                ...textCss(t),
                flex: inlineArrow ? '0 1 auto' : '1 1 auto',
                cursor: inlineArrow ? 'pointer' : undefined,
              }}
            >
              {!t.hidden ? rail.title : null}
            </div>
            {!linkLeft && link && (
              <button type="button" onClick={() => onSeeAll(rail)} style={link.style}>
                {link.text}
              </button>
            )}
          </div>
        ) : null}
        {available > 0 && (
          <div style={paddingCss(body)}>
            {headerNode && <div style={{ marginBottom: headerGap }}>{headerNode}</div>}
            <div
              ref={rowRef}
              style={{
                display: 'flex',
                flexDirection: vertical ? 'column' : 'row',
                flexWrap: layout === 'grid' ? 'wrap' : 'nowrap',
                columnGap: gap,
                rowGap: layout === 'grid' ? (rl.rowGap ?? gap) : gap,
                // A carousel scrolls sideways; a banner fits across and never scrolls; a grid wraps.
                overflowX: scrolls ? 'auto' : 'hidden',
                paddingLeft: start + (inset?.x ?? 0),
                paddingRight: end + (inset?.x ?? 0),
                paddingTop: inset?.y ?? undefined,
                paddingBottom: inset?.y ?? undefined,
              }}
            >
              {items.map((item, i) => (
                <CardView
                  key={item?.id ?? `empty-${i}`}
                  block={block}
                  title={item}
                  width={w}
                  height={h}
                  rank={i + 1}
                  onOpen={tappable ? (it) => onOpen(it, rail) : undefined}
                  onAction={onAction}
                />
              ))}
              {/* After the last card of a row that scrolls: only once its titles are here, and not when the
                  tap goes nowhere. */}
              {scrolls && rail.seeAll.endCard && loaded && rail.seeAll.tap?.type !== 'none' && (
                <EndCard
                  rail={rail}
                  design={rail.seeAll.endCardBlockKey ? (blocks[rail.seeAll.endCardBlockKey] ?? null) : null}
                  width={w}
                  height={h}
                  onOpen={() => onSeeAll(rail)}
                />
              )}
            </div>
            {footer && spanning(footer)}
          </div>
        )}
      </div>
    </section>
  );
}
