import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { isViewerRail, loadItems, loadMoreItems, refreshItems } from '@/app/pagesSlice';
import type {
  Atom,
  Block,
  PageLoading,
  Rail as RailJson,
  RailChip,
  RailLayout,
  Title,
} from '@/lib/api/types';
import { useElementWidth, useViewportHeight } from '@/lib/device/useElementWidth';
import { useInView } from '@/lib/device/useInView';
import { logLoading } from '@/lib/debug/loadingLog';
import { CardView } from '@/render/CardView';
import { CardPopup } from './CardPopup';
import { FOCUSABLE, canHover } from './cardPopupGeometry';
import { warmPopupPictures } from './popupPreload';
import { AtomView, type PartCtx } from '@/render/Parts';
import { fillCss, paddingCss, textCss } from '@/lib/render/paint';
import { isTileRail, railForChip, shownChip, tileKey, tileTitle } from '@/lib/render/chips';
import { ChipRow } from './ChipRow';

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

/** What a rail drawn up beside the hero needs to know of the hero: its designed size (px) and whether it fills the window. */
export interface HeroDesign {
  width: number;
  height: number;
  /** `card.stretch.height` is `screen`: the hero is as tall as the window. */
  screen: boolean;
}

/**
 * A rail drawn up beside the hero (`pullUp`) is laid out in the hero's own design: its start gutter, gaps and
 * cards are px for a hero `design.width` wide, and its pull-up is px for a hero `design.height` tall. The hero
 * (and the heading drawn on it) follow the page, so the rail follows it too: across in proportion to the width;
 * up by `pullFollow` (the share of the hero's height the pull follows) of the hero's change in height.
 * Otherwise its cards would sit at a fixed spot wherever the window is, on top of the hero's buttons or off the
 * edge. Any other rail is returned as it is.
 */
function scaledToHero(
  rl: RailLayout,
  available: number,
  design: HeroDesign | undefined,
  windowHeight: number,
): RailLayout {
  if (!rl.pullUp || !design || !design.width || !design.height || available <= 0) return rl;
  const k = available / design.width;
  const heroHeight = design.screen && windowHeight > 0 ? windowHeight : (available * design.height) / design.width;
  const follow = rl.pullFollow ?? 0;
  const px = (v: number | null | undefined) => (v === null || v === undefined ? null : v * k);
  return {
    ...rl,
    start: px(rl.start),
    end: px(rl.end),
    gap: px(rl.gap),
    cardWidth: px(rl.cardWidth),
    cardHeight: px(rl.cardHeight),
    headerGap:
      rl.headerGap !== null && rl.headerGap < 0 && follow > 0
        ? Math.min(0, rl.headerGap - follow * (heroHeight - design.height))
        : rl.headerGap,
  };
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
  rail: placed,
  blocks,
  onOpen,
  onAction,
  onSeeAll,
  onTile,
  eager = false,
  canLoad,
  loading,
  onSeen,
  hero,
}: {
  rail: RailJson;
  blocks: Record<string, Block>;
  onOpen: (title: Title, rail: RailJson) => void;
  /** A tile of a chip rail drawn as cards was tapped. */
  onTile?: (chip: RailChip, rail: RailJson) => void;
  onAction: (action: string, title: Title | null) => void;
  onSeeAll: (rail: RailJson) => void;
  /** The page's first row: the cards on screen load their pictures at once, not lazily. */
  eager?: boolean;
  /** Page → Loading: whether this row's batch may ask for its titles now. Missing (an older server):
   * the row asks when it comes near the screen. */
  canLoad?: boolean;
  /** Page → Loading for this device: how this row's titles load sideways. Missing: one window only. */
  loading?: PageLoading;
  /** The viewer reached this row (it is on screen, or a card in it has focus): the page may ask for the
   * next batch of rows. */
  onSeen?: () => void;
  /** The page's hero design: a rail drawn up beside the hero follows the page in that proportion (`scaledToHero`). */
  hero?: HeroDesign;
}) {
  const dispatch = useAppDispatch();
  // A chip rail: the row of chips above the cards, and the picked chip's titles in place of the rail's
  // own (`railForChip`), so loading, "See all" and its count follow the chip. Each chip's titles stay
  // loaded (kept by their address), and each keeps where its row was scrolled to.
  const [pickedChip, setPickedChip] = useState<string | null>(null);
  // Chips drawn as cards (`chips.display: cards`): the chips are the rail's cards, a tile each. No chip
  // is picked and no titles are asked for; a tile opens its own `tap`.
  const tiles = isTileRail(placed) ? (placed.chips?.items ?? null) : null;
  const tileCards = useMemo(() => tiles?.map(tileTitle) ?? null, [tiles]);
  const chip = tiles ? null : shownChip(placed, pickedChip);
  const rail = railForChip(placed, chip);
  const chipScroll = useRef<Record<string, number>>({});
  const block = rail.blockKey ? (blocks[rail.blockKey] ?? null) : null;
  const header = rail.headerKey ? (blocks[rail.headerKey] ?? null) : null;
  const footer = rail.footerKey ? (blocks[rail.footerKey] ?? null) : null;
  const [widthRef, available] = useElementWidth<HTMLDivElement>();
  const windowHeight = useViewportHeight();
  // Watched only once the row is drawn at its real height (its width known): see `useInView`.
  const [inViewRef, inView] = useInView<HTMLElement>({ enabled: available > 0 });
  // On screen now (no margin): the viewer has reached this row.
  const [seenRef, seen] = useInView<HTMLElement>({ rootMargin: '0px', once: false, enabled: available > 0 });
  const sectionRef = useCallback(
    (el: HTMLElement | null) => {
      inViewRef(el);
      seenRef(el);
    },
    [inViewRef, seenRef],
  );
  // The latest `onSeen` (a new function each render of the page), read when the row is reached.
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  });
  useEffect(() => {
    if (seen) onSeenRef.current?.();
  }, [seen]);
  const rowRef = useRef<HTMLDivElement>(null);
  const url = tiles ? '' : (rail.source.contentUrl ?? '');
  const hasTitles = tiles ? true : (rail.source.count ?? 0) > 0;
  const entry = useAppSelector((s) => s.pages.items[url]);
  // Back on a chip: its row where it was left (a new chip starts at its first card).
  useEffect(() => {
    if (chip && rowRef.current) rowRef.current.scrollLeft = chipScroll.current[chip.key] ?? 0;
  }, [chip]);
  const pickChip = (key: string) => {
    if (chip && rowRef.current) chipScroll.current[chip.key] = rowRef.current.scrollLeft;
    setPickedChip(key);
  };
  const more = useAppSelector((s) => s.pages.more[url]);

  // Sideways (Page → Loading): the next `titlesNext` titles when the viewer is `titlesNextWithin` cards
  // from the end of the row, up to `titlesMax` and the rail's own total. Only a row that scrolls sideways.
  const sideways =
    rail.layout !== 'banner' && rail.layout !== 'grid' && rail.railLayout.direction !== 'vertical';
  const paging =
    sideways && loading?.titlesNext
      ? { next: loading.titlesNext, within: loading.titlesNextWithin ?? 3, max: loading.titlesMax ?? 40 }
      : null;
  const have = entry?.status === 'ready' ? (entry.data?.length ?? 0) : 0;
  const hasMore = !!paging && have > 0 && have < Math.min(paging.max, more?.total ?? Infinity);
  const askMore = useCallback(() => {
    if (!paging || !url) return;
    const from = have;
    void dispatch(loadMoreItems({ contentUrl: url, limit: paging.next, max: paging.max })).then((a) => {
      // Logged only when it was really asked (one window at a time, none past the end): loading inspector.
      if (!loadMoreItems.fulfilled.match(a)) return;
      const got = a.payload.items.length;
      const which = got === 1 ? `card ${from + 1}` : `cards ${from + 1}–${from + got}`;
      logLoading(
        got
          ? `"${rail.title ?? rail.key}": ${which} loaded sideways (offset ${from}, limit ${paging.next})`
          : `"${rail.title ?? rail.key}": no more cards (all ${from} loaded)`,
        'cards',
      );
    });
  }, [dispatch, url, paging?.next, paging?.max, have]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Within `titlesNextWithin` cards of the row's end: ask for the next window. */
  const checkRowEnd = useCallback(() => {
    const row = rowRef.current;
    const first = row?.firstElementChild as HTMLElement | null | undefined;
    if (!row || !first || !paging || !hasMore) return;
    const gapPx = parseFloat(getComputedStyle(row).columnGap) || 0;
    const room = paging.within * (first.offsetWidth + gapPx);
    if (row.scrollWidth - row.scrollLeft - row.clientWidth <= room) askMore();
  }, [paging?.within, hasMore, askMore]); // eslint-disable-line react-hooks/exhaustive-deps
  // After each window, and on a screen wide enough to show the end at once: maybe the next one now.
  useEffect(() => {
    checkRowEnd();
  }, [have, checkRowEnd]);
  /** TV: focus on one of the last `titlesNextWithin` cards asks for the next window. */
  const onRowFocus = (e: FocusEvent<HTMLDivElement>) => {
    const row = rowRef.current;
    if (!row || !paging || !hasMore) return;
    const card = Array.from(row.children).findIndex((c) => c.contains(e.target as Node));
    if (card >= 0 && card >= have - paging.within - 1) askMore();
  };

  // The viewer's own rails (My list, Continue Watching) are asked for again each time their screen is
  // shown, at once (not when in view): what was loaded before may be out of date, and an empty list
  // kept from before draws nothing, so it would never come into view to be asked again. The titles
  // already there stay on screen until the new ones come. Any other rail is asked once, when near.
  const viewer = isViewerRail(rail);
  const refreshed = useRef(false);
  // The pop-up (below): the card it is open on. Hooks stay above every early return.
  const [pop, setPop] = useState<{ i: number; el: HTMLElement; closing?: boolean } | null>(null);
  const goneTimer = useRef<number | undefined>(undefined);
  const popTimer = useRef<number | undefined>(undefined);
  // How it leaves is the rail's JSON: `reverse` plays the opening backwards over the exit time, anything else removes it at once.
  const exitMs = rail.motion?.popup?.exit === 'reverse' ? Math.max(0, rail.motion?.timing?.exitDurationMs ?? 0) : 0;
  const closePopup = useCallback(
    (focus?: boolean | 'next') => {
      window.clearTimeout(popTimer.current);
      setPop((cur) => {
        if (!cur) return null;
        if (focus) {
          // The card's wrapper takes no place in the row, so the next card is its next sibling's card.
          const target = focus === 'next' ? (cur.el.parentElement?.nextElementSibling?.firstElementChild ?? null) : cur.el;
          window.setTimeout(() => (target as HTMLElement | null)?.focus?.(), 0);
        }
        if (!exitMs) return null;
        if (cur.closing) return cur;
        window.clearTimeout(goneTimer.current);
        goneTimer.current = window.setTimeout(() => setPop((p) => (p?.closing ? null : p)), exitMs + 40);
        return { ...cur, closing: true };
      });
    },
    [exitMs],
  );
  useEffect(
    () => () => {
      window.clearTimeout(popTimer.current);
      window.clearTimeout(goneTimer.current);
    },
    [],
  );
  // The pop-up's pictures are asked for once the rail's titles are here, so none waits for the hover.
  const warmDesign = rail.motion?.popup ? (blocks[rail.motion.popup.blockKey] ?? null) : null;
  const warmTitles = entry?.status === 'ready' ? entry.data : null;
  useEffect(() => {
    if (warmDesign && warmTitles && canHover()) warmPopupPictures(warmDesign, warmTitles);
  }, [warmDesign, warmTitles]);
  // One pop-up on the whole page: another rail opening its own closes this one at once.
  useEffect(() => {
    const other = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== rail.key) {
        window.clearTimeout(popTimer.current);
        setPop(null);
      }
    };
    window.addEventListener('card-popup-open', other);
    return () => window.removeEventListener('card-popup-open', other);
  }, [rail.key]);
  // No titles held: never asked, or gone since. Whenever that happens while the rail is shown, it asks
  // again (a safety net: a shown rail is never left with no titles and no call on its way).
  const missing = !entry;
  useEffect(() => {
    if (!url || !hasTitles) return;
    if (viewer && !refreshed.current) {
      // Once per showing: the titles kept from before are asked for again (the first load counts).
      refreshed.current = true;
      if (entry) {
        void dispatch(refreshItems(url));
        return;
      }
    }
    // With Page → Loading the row asks when its batch is let in; else when it comes near the screen.
    if ((canLoad ?? inView) && missing) {
      void dispatch(loadItems(url));
      logLoading(
        `"${rail.title ?? rail.key}": titles asked (${new URL(url, 'http://x').searchParams.get('limit') ?? '?'} cards)`,
      );
    }
    // `entry` only decides whether there is something to refresh; `missing` asks again when it goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, canLoad, url, hasTitles, viewer, missing, dispatch]);

  // Nothing to show (`count` 0, no design), or titles that came back empty or failed: no room taken.
  if (!hasTitles || !block) return null;
  if (entry && (entry.status === 'failed' || (entry.status === 'ready' && (entry.data?.length ?? 0) === 0)))
    return null;

  const body = rail.railLayout.bodyPadding;
  const lane = Math.max(0, available - (body?.left ?? 0) - (body?.right ?? 0));
  const rl = scaledToHero(rail.railLayout, available, hero, windowHeight);
  const loaded = tileCards ?? (entry?.status === 'ready' && entry.data ? entry.data : null);
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
  // The next window on its way: its cards are drawn empty (shimmering) at the end of the row meanwhile.
  if (scrolls && loaded && more?.loading && paging) {
    const coming = Math.max(
      0,
      Math.min(paging.next, Math.min(paging.max, more.total ?? Infinity) - loaded.length),
    );
    items = [...items, ...Array.from({ length: coming }, () => null)];
  }
  // Titles not here yet: the empty (shimmering) cards fill the lane, and one more peeks in, however few
  // the first window holds, so a row waiting for its titles does not stop halfway across the screen.
  if (scrolls && !loaded && w > 0) {
    const fill = Math.min(30, Math.ceil((lane - start) / (w + gap)) + 1);
    if (items.length < fill) items = Array.from({ length: fill }, () => null);
  }
  // On the page's first row, the cards on screen when it opens (the ones across the lane, or the top two
  // of a column) load their pictures at once; the rest of the row stays lazy, loaded as it is scrolled to.
  const onScreen = !eager ? 0 : vertical ? 2 : Math.max(1, Math.ceil((lane - start) / Math.max(1, w + gap)));
  // TV: free room around the cards for the focus look (a focused card grows and glows).
  const inset = rl.focusInset;
  const t = rail.titleStyle;
  const tappable = rail.tap.card.type !== 'none' || Object.keys(rail.tap.cards).length > 0;
  /** A tile's card was tapped: the chip it stands for. */
  const openTile = (card: Title) => {
    const tapped = tiles?.find((c) => c.key === tileKey(card));
    if (tapped && tapped.tap?.type !== 'none') onTile?.(tapped, placed);
  };

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
  // `span` is how wide the strip may be: the lane, or less where the caller pads it (a header with a start and an end).
  const strip = (b: Block, span = lane) => {
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
          width: span,
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
                  a.action === 'see_all'
                    ? arrowOnlyLink
                      ? arrowOnly(a)
                      : withLabel(a, rail.seeAll.label)
                    : a
                }
                ctx={{ ...stripCtx, cardW: span }}
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
  const spanning = (b: Block, span = lane) =>
    b.card.display === 'strip' ? (
      strip(b, span)
    ) : b.atoms.some((a) => a.frame) || b.components.some((c) => c.slot === 'card' && c.frame) ? (
      <CardView
        block={b}
        title={null}
        width={span}
        height={b.card.width && b.card.height ? (span * b.card.height) / b.card.width : 0}
        standalone
      />
    ) : null;

  const headerNode = header ? spanning(header, Math.max(0, lane - start - end)) : null;

  // The pop-up (web): the card the pointer or focus rests on, for `dwellMs`, shows this rail's pop-up design for the
  // same title. One at a time; leaving both the card and the pop-up closes it; nothing on the page moves.
  const popupSpec = rail.motion?.popup ?? null;
  const popupDesign = popupSpec ? (blocks[popupSpec.blockKey] ?? null) : null;
  const popupOn = Boolean(popupSpec && popupDesign && rail.motion && canHover());
  const openPopup = (i: number, el: HTMLElement | null) => {
    if (!popupOn || !el || !items[i]) return;
    window.clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('card-popup-open', { detail: rail.key }));
      window.clearTimeout(goneTimer.current);
      setPop({ i, el });
    }, Math.max(0, rail.motion?.dwellMs ?? 0));
  };
  const leavePopup = () => {
    window.clearTimeout(popTimer.current);
    popTimer.current = window.setTimeout(() => closePopup(false), Math.max(0, rail.motion?.popup?.leaveGraceMs ?? 0));
  };

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
    <section
      ref={sectionRef}
      aria-label={rail.title ?? undefined}
      style={fillCss(rail.background)}
      onFocusCapture={() => onSeenRef.current?.()}
    >
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
            {/* A header design lines up with the cards: it takes the same space at either end as they do. */}
            {headerNode && <div style={{ marginBottom: headerGap, paddingLeft: start, paddingRight: end }}>{headerNode}</div>}
            {/* A chip rail: its chips between the title (or header design) and the cards. */}
            {!tiles && placed.chips && placed.chips.items.length > 0 && (
              <ChipRow
                chips={placed.chips.items}
                selected={chip?.key ?? null}
                onSelect={pickChip}
                fontFamily={t.fontFamily ?? undefined}
                paddingLeft={start}
                paddingRight={end}
                marginBottom={headerGap || 12}
              />
            )}
            <div
              ref={rowRef}
              onScroll={scrolls ? checkRowEnd : undefined}
              onFocusCapture={scrolls ? onRowFocus : undefined}
              style={{
                display: 'flex',
                flexDirection: vertical ? 'column' : 'row',
                flexWrap: layout === 'grid' ? 'wrap' : 'nowrap',
                columnGap: gap,
                rowGap: layout === 'grid' ? (rl.rowGap ?? gap) : gap,
                // A carousel scrolls sideways; a banner fits across and never scrolls; a grid wraps.
                overflowX: scrolls ? 'auto' : 'hidden',
                // A rail drawn beside the hero is a column: its row begins `start` in from the window's left and stops
                // `end` short of its right (the cards scroll inside that column, never under the hero's text or past
                // the window), instead of padding a row that spans the whole window.
                paddingLeft: (rl.pullUp ? 0 : start) + (inset?.x ?? 0),
                paddingRight: (rl.pullUp ? 0 : end) + (inset?.x ?? 0),
                marginLeft: rl.pullUp ? start : undefined,
                marginRight: rl.pullUp ? end : undefined,
                paddingTop: inset?.y ?? undefined,
                paddingBottom: inset?.y ?? undefined,
              }}
            >
              {items.map((item, i) => {
                const card = (
                  <CardView
                    key={item?.id ?? `empty-${i}`}
                    block={block}
                    title={item}
                    width={w}
                    height={h}
                    rank={i + 1}
                    priority={i < onScreen ? 'eager' : 'lazy'}
                    onOpen={tiles ? openTile : tappable ? (it) => onOpen(it, rail) : undefined}
                    onAction={onAction}
                  />
                );
                if (!popupOn) return card;
                // `display: contents` takes no place in the row: the wrapper only listens.
                return (
                  <div
                    key={item?.id ?? `empty-${i}`}
                    style={{ display: 'contents' }}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && openPopup(i, e.currentTarget.firstElementChild as HTMLElement)}
                    onPointerLeave={(e) => e.pointerType === 'mouse' && leavePopup()}
                    onFocus={(e) => openPopup(i, e.currentTarget.firstElementChild as HTMLElement)}
                    onBlur={(e) => {
                      // Focus moving into the pop-up keeps it open (the pop-up is outside this wrapper).
                      const to = e.relatedTarget as HTMLElement | null;
                      if (!to?.closest?.('[data-card-popup]')) leavePopup();
                    }}
                    onKeyDown={(e) => {
                      const el = e.currentTarget.firstElementChild as HTMLElement;
                      if (e.key === 'Tab' && !e.shiftKey && pop?.i === i && e.target === el) {
                        const first = document.querySelector<HTMLElement>(`[data-card-popup] ${FOCUSABLE.split(', ').join(', [data-card-popup] ')}`);
                        if (first) {
                          e.preventDefault();
                          first.focus();
                        }
                      }
                    }}
                  >
                    {card}
                  </div>
                );
              })}
              {/* After the last card of a row that scrolls: only once its titles are here, and not when the
                  tap goes nowhere. */}
              {scrolls &&
                !tiles &&
                rail.seeAll.endCard &&
                loaded &&
                !hasMore &&
                rail.seeAll.tap?.type !== 'none' && (
                  <EndCard
                    rail={rail}
                    design={
                      rail.seeAll.endCardBlockKey ? (blocks[rail.seeAll.endCardBlockKey] ?? null) : null
                    }
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
      {pop && popupOn && popupSpec && popupDesign && rail.motion && items[pop.i] && (
        <CardPopup
          anchor={pop.el}
          cardDesignWidth={block?.card.width ?? 0}
          spec={popupSpec}
          design={popupDesign}
          title={items[pop.i] as Title}
          motion={rail.motion}
          onOpen={tappable ? (it) => onOpen(it, rail) : undefined}
          onAction={onAction}
          onEnter={() => window.clearTimeout(popTimer.current)}
          onLeave={leavePopup}
          closing={pop.closing === true}
          exitMs={exitMs}
          onClose={closePopup}
        />
      )}
    </section>
  );
}
