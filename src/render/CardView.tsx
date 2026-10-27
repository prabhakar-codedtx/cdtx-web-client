import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import styled from 'styled-components';
import type { Atom, Block, Card, Component, Frame, LayoutItem, Rule, Title } from '@/lib/api/types';
import { imageSrc } from '@/lib/render/fields';
import { fitOf } from '@/lib/render/units';
import {
  boxShadowCss,
  fillCss,
  gradientCss,
  objectFitCss,
  paddingCss,
  polygonCss,
  rgba,
  strokeCss,
} from '@/lib/render/paint';
import { resolveLayout } from '@/lib/layout/resolve';
import type { Attribute, Box, LayoutRule, Relation } from '@/lib/layout/types';
import { AtomView, flexOf, isDrawn, type PartCtx } from '@/render/Parts';

/**
 * One card: a block (`page.blocks[rail.blockKey]`) and one title. Nothing about how it looks is
 * decided here: the layers are the ones `card.stack` lists, every atom and component sits where its
 * `frame` says (fractions of the drawn card), and every length is the JSON's times the card's `fit`.
 */

// ---- frames -----------------------------------------------------------------------------------

/**
 * A frame as CSS: the box's `pivot` point sits on (`cx`, `cy`). A `fixed` or `min` box keeps the size
 * it was designed at (its fraction of the designed card, times `fit`), so a card drawn wider than it
 * was designed (a hero that fills the window) moves its parts but does not stretch them; a `fill`
 * box follows the card. A box with no `w` hugs its content, at most `maxW` of the card.
 */
function frameCss(f: Frame, W: number, H: number, designed: { w: number; h: number }): CSSProperties {
  const sizeW = f.sizing === 'fill' ? W : designed.w;
  const sizeH = f.sizing === 'fill' ? H : designed.h;
  const css: CSSProperties = { position: 'absolute', left: (f.cx ?? 0) * W, top: (f.cy ?? 0) * H };
  const tx = -(f.pivot.x ?? 0) * 100;
  const ty = -(f.pivot.y ?? 0) * 100;
  if (tx !== 0 || ty !== 0) css.transform = `translate(${tx}%, ${ty}%)`;
  if (f.w !== null) {
    if (f.sizing === 'min') css.minWidth = f.w * sizeW;
    else css.width = f.w * sizeW;
  } else {
    // Hug: as wide as its content, up to `maxW` of the card. Without `max-content` the browser would
    // size it in the room right of `left`, so a box pinned top-right would wrap one word per line.
    css.width = 'max-content';
    css.maxWidth = (f.maxW ?? 1) * W;
  }
  if (f.h !== null) {
    if (f.sizing === 'min') css.minHeight = f.h * sizeH;
    else css.height = f.h * sizeH;
  }
  return css;
}

/** Where a frame puts the box's top-left corner when the box has this size. */
const originOf = (f: Frame, W: number, H: number, w: number, h: number) => ({
  x: (f.cx ?? 0) * W - (f.pivot.x ?? 0) * w,
  y: (f.cy ?? 0) * H - (f.pivot.y ?? 0) * h,
});

/** A schema 3 rule for the shared resolver: nulls are "not given" (`multiplier` null = 1). */
function toLayoutRule(r: Rule, k: number): LayoutRule | null {
  if (!r.id || !r.item || !r.attr || !r.relation) return null;
  return {
    id: r.id,
    item: r.item,
    attr: r.attr as Attribute,
    relation: r.relation as Relation,
    target: r.target ?? undefined,
    targetAttr: (r.targetAttr ?? undefined) as Attribute | undefined,
    multiplier: r.multiplier ?? undefined,
    constant: (r.constant ?? 0) * k,
  };
}

// ---- a component (an auto layout) --------------------------------------------------------------

/** The atoms an auto layout lists, nested groups included (an atom no item lists is not drawn). */
function listed(items: LayoutItem[]): string[] {
  return items.flatMap((it) => (it.type === 'group' ? listed(it.items) : it.id ? [it.id] : []));
}

/** A component's `layoutRules` that only size the component itself (no target) become its limits. */
function sizeLimits(rules: Rule[], k: number): CSSProperties {
  const css: CSSProperties = {};
  for (const r of rules) {
    if (r.target || (r.attr !== 'width' && r.attr !== 'height') || r.constant === null) continue;
    const v = r.constant * k;
    const w = r.attr === 'width';
    if (r.relation === 'eq') css[w ? 'width' : 'height'] = v;
    else if (r.relation === 'gte') css[w ? 'minWidth' : 'minHeight'] = v;
    else css[w ? 'maxWidth' : 'maxHeight'] = v;
  }
  return css;
}

function ComponentView({
  comp,
  ctx,
  hasFrameWidth,
}: {
  comp: Component;
  ctx: PartCtx;
  hasFrameWidth: boolean;
}) {
  const al = comp.autoLayout;
  const k = ctx.fit;
  const byId = new Map(comp.atoms.map((a) => [a.id, a]));
  const row = (dir: string | null) => (dir === 'vertical' ? 'column' : 'row');
  const css: CSSProperties = {
    display: 'flex',
    flexDirection: row(al.direction),
    justifyContent: flexOf(al.mainAxis),
    alignItems: flexOf(al.crossAxis),
    columnGap: al.direction === 'vertical' ? undefined : (al.gap ?? 0) * k,
    rowGap: al.direction === 'vertical' ? (al.gap ?? 0) * k : (al.rowGap ?? al.gap ?? 0) * k,
    flexWrap: al.wrap ? 'wrap' : 'nowrap',
    boxSizing: 'border-box',
    ...paddingCss(al.padding, k),
    ...(hasFrameWidth || al.width.mode === 'fill'
      ? { width: '100%' }
      : al.width.mode === 'fixed' && al.width.value !== null
        ? { width: al.width.value * k }
        : {}),
    ...(al.height.mode === 'fixed' && al.height.value !== null ? { height: al.height.value * k } : {}),
    ...sizeLimits(comp.layoutRules, k),
  };
  // A hidden atom (a badge the title lacks, empty text) takes no room: the rest close up.
  const draw = (items: LayoutItem[]) =>
    items.map((it, i) => {
      if (it.type === 'group') {
        const members = draw(it.items).filter(Boolean);
        if (members.length === 0) return null;
        // A group of facts in a row (Year | Genre | Duration): a separator between the ones that show.
        const sep = it.direction !== 'vertical' ? it.separator : null;
        return (
          <div
            key={it.id ?? `g${i}`}
            style={{
              display: 'flex',
              flexDirection: row(it.direction),
              alignItems: it.direction === 'vertical' ? 'flex-start' : 'center',
              flexWrap: it.direction === 'vertical' ? 'nowrap' : 'wrap',
              gap: (it.gap ?? 0) * k,
            }}
          >
            {members.map((m, j) => (
              <Fragment key={j}>
                {j > 0 && sep && (
                  <span aria-hidden style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 * k }}>
                    {sep}
                  </span>
                )}
                {m}
              </Fragment>
            ))}
          </div>
        );
      }
      const atom = it.id ? byId.get(it.id) : undefined;
      if (!atom || !isDrawn(atom, ctx.title)) return null;
      return <AtomView key={atom.id} atom={atom} ctx={ctx} inFrame={false} />;
    });
  return <div style={css}>{draw(al.items)}</div>;
}

// ---- the card ------------------------------------------------------------------------------------

/**
 * The card's box: its width and height are the rail's, its parts are placed inside it, and its TV
 * focus look is `card.focus` (null: none).
 */
const Root = styled.div<{ $radius: string; $focus: Card['focus']; $k: number }>`
  position: relative;
  flex: none;
  /* The rank numeral may sit behind the card (z-index -1): keep it inside this card, above the page. */
  isolation: isolate;
  border-radius: ${(p) => p.$radius};
  ${(p) => {
    const f = p.$focus;
    if (!f) return '';
    const ring =
      f.border?.width && f.border.color ? `0 0 0 ${f.border.width * p.$k}px ${rgba(f.border.color)}` : '';
    const glow = f.glow?.color
      ? `0 0 ${(f.glow.blur ?? 0) * p.$k}px ${rgba(f.glow.color, f.glow.opacity ?? 1)}`
      : '';
    return `transition: transform ${f.durationMs ?? 0}ms;
  &:focus-visible {
    outline: none;
    z-index: 1;
    transform: scale(${f.scale ?? 1});
    box-shadow: ${[ring, glow].filter(Boolean).join(', ') || 'none'};
  }`;
  }}
`;

export interface CardViewProps {
  block: Block;
  /** The title the card shows; null draws the empty card (a title still on its way). */
  title: Title | null;
  width: number;
  height: number;
  /** The rank numeral of a Top 10 card: this card's place in its rail, from 1. */
  rank?: number;
  onOpen?: (title: Title) => void;
  onAction?: (action: string, title: Title | null) => void;
  /** Paints the card ahead of the page (a hero is drawn the moment it is on screen). */
  priority?: boolean;
  /** A rail's header or footer: drawn with no title. */
  standalone?: boolean;
}

interface Placed {
  id: string;
  frame: Frame;
  z: number | null;
  atom?: Atom;
  comp?: Component;
}

export function CardView({
  block,
  title,
  width: W,
  height: H,
  rank,
  onOpen,
  onAction,
  priority,
  standalone,
}: CardViewProps) {
  const card = block.card;
  const fit = fitOf({ width: W, height: H }, card);
  const ctx: PartCtx = { title, fit, cardW: W, aspect: card.imageAspect, onAction };
  // The designed card at the size it is drawn: what a fixed or minimum box is a fraction of.
  const designed = { w: (card.width ?? W) * fit, h: (card.height ?? H) * fit };
  const rootRef = useRef<HTMLDivElement>(null);
  const showParts = Boolean(title) || Boolean(standalone);

  // What sits on the card for this title, each with its frame. An atom the title does not show takes
  // no place; a component with nothing left to show is not drawn.
  const placed = useMemo<Placed[]>(() => {
    const out: Placed[] = [];
    for (const atom of block.atoms) {
      if (!atom.frame || !isDrawn(atom, title)) continue;
      out.push({ id: atom.id, frame: atom.frame, z: atom.zIndex, atom });
    }
    for (const comp of block.components) {
      if (comp.slot !== 'card' || !comp.frame) continue;
      const ids = new Set(listed(comp.autoLayout.items));
      if (!comp.atoms.some((a) => ids.has(a.id) && isDrawn(a, title))) continue;
      out.push({ id: comp.id, frame: comp.frame, z: comp.zIndex, comp });
    }
    return out;
  }, [block, title]);

  // ---- layout rules: measure each part's natural size, solve, place ------------------------------
  // A rule whose item or target is not drawn for this title is left out: that part keeps its frame.
  const rules = useMemo<LayoutRule[]>(() => {
    const ids = new Set(placed.map((p) => p.id));
    return block.layoutRules
      .filter((r) => r.item && ids.has(r.item) && (!r.target || r.target === 'parent' || ids.has(r.target)))
      .map((r) => toLayoutRule(r, fit))
      .filter((r): r is LayoutRule => r !== null);
  }, [block.layoutRules, placed, fit]);
  const [solved, setSolved] = useState<{
    boxes: Record<string, Box>;
    naturals: Record<string, { w: number; h: number }>;
  } | null>(null);
  const ruleKey = `${block.id}|${W}|${H}|${fit}|${title?.id ?? ''}|${rules.length}`;
  const lastKey = useRef(ruleKey);

  useLayoutEffect(() => {
    if (lastKey.current !== ruleKey) {
      lastKey.current = ruleKey;
      setSolved(null); // measure again from each part's natural size
      return;
    }
    if (rules.length === 0 || solved !== null || !rootRef.current) return;
    const naturals: Record<string, { w: number; h: number }> = {};
    const items = placed.flatMap((p) => {
      const node = rootRef.current!.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(p.id)}"]`);
      if (!node) return [];
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      naturals[p.id] = { w, h };
      const o = originOf(p.frame, W, H, w, h);
      return [{ id: p.id, width: w, height: h, x: o.x, y: o.y }];
    });
    setSolved({ boxes: resolveLayout({ parent: { width: W, height: H }, items, rules }).boxes, naturals });
  });

  // A late font changes how wide the text is: measure again once fonts are in.
  useLayoutEffect(() => {
    if (rules.length === 0 || !('fonts' in document)) return;
    let live = true;
    void document.fonts.ready.then(() => live && setSolved(null));
    return () => {
      live = false;
    };
  }, [rules.length, block.id]);

  // A frame with a size (`fixed`, `min`, `fill`) is the part's own size: the part fills it.
  const sized = (f: Frame): boolean => f.w !== null || f.h !== null;

  const placement = (p: Placed): CSSProperties => {
    const css: CSSProperties = {
      ...frameCss(p.frame, W, H, designed),
      ...(sized(p.frame) ? { display: 'flex' } : {}),
    };
    const box = solved?.boxes[p.id];
    if (!box) return css;
    // A rule moved or resized it: keep every size the frame gave it, replace where it sits.
    const nat = solved?.naturals[p.id];
    const out: CSSProperties = { ...css, left: box.x, top: box.y, transform: undefined };
    if (nat && Math.abs(box.width - nat.w) > 0.5) {
      out.width = box.width;
      out.minWidth = undefined;
    }
    if (nat && Math.abs(box.height - nat.h) > 0.5) {
      out.height = box.height;
      out.minHeight = undefined;
    }
    return out;
  };

  // ---- the layers of `card.stack` -------------------------------------------------------------------
  const z = (layer: string): number | undefined => card.stack.find((s) => s.layer === layer)?.zIndex;
  const c = card.cornerRadiusFrac;
  const radius = `${(c.topLeft ?? 0) * W}px ${(c.topRight ?? 0) * W}px ${(c.bottomRight ?? 0) * W}px ${(c.bottomLeft ?? 0) * W}px`;
  const bg = card.background;
  const bgImage = bg?.type === 'image' && bg.image ? imageSrc(bg.image, title, card.imageAspect) : null;
  const inset = card.insetImage;
  const insetSrc = inset ? imageSrc(inset, title, card.imageAspect) : null;
  const layer = (name: string, extra: CSSProperties = {}): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    zIndex: z(name),
    pointerEvents: 'none',
    ...extra,
  });

  const numeral = block.rank && rank !== undefined && (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        zIndex: block.rank.layer === 'back' ? -1 : undefined,
        ...rankCss(block.rank),
      }}
    >
      {rank}
    </div>
  );
  const behind = block.rank?.layer === 'back';

  const open = () => title && onOpen?.(title);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };
  const interactive = Boolean(onOpen && title);

  return (
    <Root
      ref={rootRef}
      $radius={radius}
      $focus={card.focus}
      $k={fit}
      style={{ width: W, height: H }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={title?.title ?? undefined}
      onClick={interactive ? open : undefined}
      onKeyDown={interactive ? onKey : undefined}
    >
      {behind && numeral}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: radius,
          boxShadow: boxShadowCss(card.shadows, fit),
          clipPath: polygonCss(card.shapePolygon),
        }}
      >
        {/* background: a colour or gradient; a picture over `fallbackColor`, under black at `scrim` */}
        {bg && bg.type !== 'image' && <div style={layer('background', fillCss(bg))} />}
        {bg?.type === 'image' && (
          <>
            {bg.fallbackColor && (
              <div style={layer('background', { backgroundColor: rgba(bg.fallbackColor) })} />
            )}
            {bgImage && (
              <img
                src={bgImage}
                alt=""
                draggable={false}
                loading={priority ? 'eager' : 'lazy'}
                style={{ ...layer('background'), width: '100%', height: '100%', ...objectFitCss(bg.image) }}
              />
            )}
            {bg.scrim ? (
              <div style={layer('background', { backgroundColor: `rgba(0,0,0,${bg.scrim})` })} />
            ) : null}
          </>
        )}
        {inset && insetSrc && (
          <img
            src={insetSrc}
            alt=""
            draggable={false}
            loading={priority ? 'eager' : 'lazy'}
            style={{
              position: 'absolute',
              left: (inset.left ?? 0) * fit,
              top: (inset.top ?? 0) * fit,
              width: inset.width !== null ? inset.width * fit : undefined,
              height: inset.height !== null ? inset.height * fit : undefined,
              ...objectFitCss(inset),
              clipPath: polygonCss(inset.shapePolygon),
              zIndex: z('insetImage'),
            }}
          />
        )}
        {card.shade.map((g, i) => (
          <div key={i} style={layer('shade', { backgroundImage: gradientCss(g) })} />
        ))}
        {card.border && (
          <div style={layer('outline', { borderRadius: radius, ...strokeCss(card.border, fit) })} />
        )}
        {showParts &&
          placed.map((p) => (
            <div key={p.id} data-item-id={p.id} style={{ ...placement(p), zIndex: p.z ?? undefined }}>
              {p.atom ? (
                <AtomView
                  atom={p.atom}
                  ctx={ctx}
                  inFrame
                  style={sized(p.frame) ? { flex: '1 1 auto' } : undefined}
                />
              ) : (
                <ComponentView comp={p.comp!} ctx={ctx} hasFrameWidth={p.frame.w !== null} />
              )}
            </div>
          ))}
      </div>
      {!behind && numeral}
    </Root>
  );
}

/**
 * The rank numeral as `block.rank` says: its colour, painted solid, as an outline, or with its
 * gradient. The JSON sends no size, font or place for it, so none is set here.
 */
function rankCss(rank: NonNullable<Block['rank']>): CSSProperties {
  const color = rgba(rank.color);
  if (rank.style === 'outline')
    return { color: 'transparent', WebkitTextStrokeColor: color } as CSSProperties;
  if (rank.style === 'gradient' && rank.gradient) {
    return {
      backgroundImage: gradientCss(rank.gradient),
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
    } as CSSProperties;
  }
  return { color };
}
