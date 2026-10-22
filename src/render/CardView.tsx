import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import styled from 'styled-components';
import type {
  AutoLayout,
  CardDesign,
  CardElement,
  CompositeComponent,
  Frame,
  PictureFit,
  Presentation,
  TitleItem,
} from '@/lib/api/types';
import { imageFor } from '@/lib/render/fields';
import { fitOf } from '@/lib/render/units';
import { resolveLayout } from '@/lib/layout/resolve';
import type { Box, LayoutRule } from '@/lib/layout/types';
import { ElementView, flexOf, type PartCtx } from '@/render/Parts';

/**
 * One card, drawn from its design JSON and one title. Nothing about how it looks is decided here:
 * the layers are the ones `presentation.stack` lists, every part sits where its `frame` says,
 * and the lengths are the design's px times the part's `scale` times the card's `fit`.
 */

// ---- frames -----------------------------------------------------------------------------------

/**
 * A frame is a placement as fractions of the card: where, and (when known) how big. A box that is
 * `fixed` or `min` keeps the size it was designed at (its fraction of the *designed* card, times the
 * card's `fit`), so a card drawn wider or taller than it was designed (a hero that fills the
 * window) moves its parts but does not stretch them; a `fill` box follows the card.
 */
function frameCss(f: Frame, W: number, H: number, design: { w: number; h: number }): CSSProperties {
  const sizeW = f.sizing === 'fill' ? W : design.w;
  const sizeH = f.sizing === 'fill' ? H : design.h;
  const hasX = f.x !== null && f.w !== null;
  const hasY = f.y !== null && f.h !== null;
  const css: CSSProperties = {
    position: 'absolute',
    left: hasX ? f.x! * W : f.cx * W,
    top: hasY ? f.y! * H : f.cy * H,
  };
  const tx = hasX ? 0 : -f.pivot.x * 100;
  const ty = hasY ? 0 : -f.pivot.y * 100;
  if (tx !== 0 || ty !== 0) css.transform = `translate(${tx}%, ${ty}%)`;
  if (f.w !== null) {
    if (f.sizing === 'min') css.minWidth = f.w * sizeW;
    else css.width = f.w * sizeW;
  } else {
    // A box that hugs its content is as wide as its content, up to `maxW` of the card. Without
    // this the browser sizes it in the room right of `left` (before the translate moves it back),
    // so badges pinned top-right would wrap one per line.
    css.width = 'max-content';
    css.maxWidth = (f.maxW ?? 1) * W;
  }
  if (f.h !== null) {
    if (f.sizing === 'min') css.minHeight = f.h * sizeH;
    else css.height = f.h * sizeH;
  }
  return css;
}

/** Where a frame puts its top-left corner when the box has this size. */
function naturalOrigin(f: Frame, W: number, H: number, w: number, h: number): { x: number; y: number } {
  return {
    x: f.x !== null && f.w !== null ? f.x * W : f.cx * W - f.pivot.x * w,
    y: f.y !== null && f.h !== null ? f.y * H : f.cy * H - f.pivot.y * h,
  };
}

// ---- colours and edges ----------------------------------------------------------------------------

function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  let hex = m[1]!;
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function borderCss(b: NonNullable<Presentation['border']>): CSSProperties {
  if (!b.color || b.widthPx <= 0) return {};
  const line = `${b.widthPx}px solid ${b.color}`;
  const sides = b.edges === 'all' ? ['top', 'right', 'bottom', 'left'] : b.edges.split(/[\s,+-]+/);
  const css: Record<string, string> = {};
  for (const s of sides)
    if (['top', 'right', 'bottom', 'left'].includes(s))
      css[`border${s[0]!.toUpperCase()}${s.slice(1)}`] = line;
  return css as CSSProperties;
}

// ---- the card's own pictures ----------------------------------------------------------------------

/** How a card picture fills its box, as its JSON says (`fit`, `alignH`, `alignV`); none sent, none set. */
function pictureFitCss(p: PictureFit | null | undefined): CSSProperties {
  if (!p) return {};
  const fit = p.fit === 'cover' || p.fit === 'contain' || p.fit === 'fill' ? p.fit : undefined;
  const at = p.alignH || p.alignV ? `${p.alignH ?? 'center'} ${p.alignV ?? 'center'}` : undefined;
  return { objectFit: fit, objectPosition: at };
}

// ---- a dropped component (an auto layout) ---------------------------------------------------------

function sizeLimits(rules: LayoutRule[] | undefined, fit: number): CSSProperties {
  const css: CSSProperties = {};
  for (const r of rules ?? []) {
    if (r.target || (r.attr !== 'width' && r.attr !== 'height')) continue;
    const v = r.constant * fit;
    const w = r.attr === 'width';
    if (r.relation === 'eq') css[w ? 'width' : 'height'] = v;
    else if (r.relation === 'gte') css[w ? 'minWidth' : 'minHeight'] = v;
    else css[w ? 'maxWidth' : 'maxHeight'] = v;
  }
  return css;
}

function CompositeView({
  comp,
  ctx,
  hasFrameWidth,
}: {
  comp: CompositeComponent;
  ctx: PartCtx;
  hasFrameWidth: boolean;
}) {
  const al: AutoLayout = comp.autoLayout;
  const u = (comp.elements[0]?.scale ?? 1) * ctx.fit;
  const byId = new Map(comp.elements.map((e) => [e.id, e]));
  const pad = al.padding;
  // The layout's lengths, final when the server sends them, else the design's times the scale.
  const fx = al.px;
  const f = (final: number | undefined, design: number): number =>
    final !== undefined ? final * ctx.fit : design * u;
  const css: CSSProperties = {
    display: 'flex',
    flexDirection: al.direction === 'vertical' ? 'column' : 'row',
    justifyContent: flexOf(al.mainAxis),
    alignItems: flexOf(al.crossAxis),
    gap: f(fx?.gap, al.gap),
    flexWrap: al.wrap ? 'wrap' : 'nowrap',
    padding: `${f(fx?.padding?.top, pad.top ?? pad.y)}px ${f(fx?.padding?.right, pad.right ?? pad.x)}px ${f(fx?.padding?.bottom, pad.bottom ?? pad.y)}px ${f(fx?.padding?.left, pad.left ?? pad.x)}px`,
    ...(hasFrameWidth || al.width.mode === 'fill'
      ? { width: '100%' }
      : al.width.mode === 'fixed' && al.width.px !== undefined
        ? { width: f(fx?.width, al.width.px) }
        : {}),
    ...(al.height.mode === 'fixed' && al.height.px !== undefined
      ? { height: f(fx?.height, al.height.px) }
      : {}),
    ...sizeLimits(comp.layoutRules, ctx.fit),
  };
  const place = (el: CardElement | undefined) =>
    el ? <ElementView key={el.id} el={el} ctx={ctx} inFrame={false} /> : null;
  return (
    <div style={css}>
      {al.items.map((it) =>
        it.type === 'element' ? (
          place(byId.get(it.id))
        ) : (
          <div
            key={it.id}
            style={{
              display: 'flex',
              flexDirection: it.direction === 'vertical' ? 'column' : 'row',
              gap: it.gap * u,
            }}
          >
            {it.elementIds.map((id) => place(byId.get(id)))}
          </div>
        ),
      )}
    </div>
  );
}

// ---- the card ------------------------------------------------------------------------------------------

/**
 * The card's box: its width and height are the rail's (it never shrinks in a row), its parts are
 * placed inside it, and its focus look is `presentation.focus` (none sent, none drawn).
 */
const Root = styled.div<{ $radius: string; $focus: Presentation['focus'] }>`
  position: relative;
  flex: none;
  /* The rank numeral sits behind the card (z-index -1): keep it inside this card, above the page. */
  isolation: isolate;
  border-radius: ${(p) => p.$radius};
  ${(p) =>
    p.$focus
      ? `transition: transform ${p.$focus.durationMs}ms;
  &:focus-visible {
    outline: none;
    transform: scale(${p.$focus.scale});
    box-shadow: ${[
      p.$focus.border ? `0 0 0 ${p.$focus.border.widthPx}px ${p.$focus.border.color}` : '',
      p.$focus.glow
        ? `0 0 ${p.$focus.glow.blurPx}px ${withAlpha(p.$focus.glow.color, p.$focus.glow.opacity)}`
        : '',
    ]
      .filter(Boolean)
      .join(', ')};
  }`
      : ''}
`;

export interface CardViewProps {
  design: CardDesign;
  /** The title the card shows; null draws the empty card (a title still on its way). */
  item: TitleItem | null;
  width: number;
  height: number;
  /** The rank numeral of a "top 10" card: this card's place in its rail, from 1. */
  rank?: number;
  onOpen?: (item: TitleItem) => void;
  onAction?: (action: string, item: TitleItem | null) => void;
  /** Paints the card ahead of the page (a hero is drawn the moment it is on screen). */
  priority?: boolean;
}

interface Placed {
  id: string;
  frame: Frame;
  z: number | undefined;
  el?: CardElement;
  comp?: CompositeComponent;
}

export function CardView({
  design,
  item,
  width: W,
  height: H,
  rank,
  onOpen,
  onAction,
  priority,
}: CardViewProps) {
  const pres = design.presentation;
  const fit = fitOf({ width: W, height: H }, pres.contentFit);
  const ctx: PartCtx = { item, fit, aspect: pres.contentImageAspect, onAction };
  // The designed card size at the size it is drawn: what a fixed or minimum box is a fraction of.
  const designed = { w: pres.contentFit.designedWidthPx * fit, h: pres.contentFit.designedHeightPx * fit };
  const rootRef = useRef<HTMLDivElement>(null);

  // What sits on the card, each with the frame the server worked out for it.
  const placed = useMemo<Placed[]>(() => {
    const out: Placed[] = [];
    for (const el of design.elements) {
      if (el.hidden || !el.frame) continue;
      out.push({ id: el.id, frame: el.frame, z: el.zIndex, el });
    }
    for (const comp of design.compositeComponents) {
      if (comp.slot !== 'card' || !comp.frame) continue;
      out.push({ id: comp.id, frame: comp.frame, z: comp.zIndex, comp });
    }
    return out;
  }, [design]);

  // ---- layout rules: measure what each part naturally is, solve, place --------------------------------
  const rules = useMemo<LayoutRule[]>(
    () => (design.layoutRules ?? []).map((r) => ({ ...r, constant: r.constant * fit })),
    [design.layoutRules, fit],
  );
  // What the rules worked out, with each part's natural size it was worked out from; null = measure again.
  const [solved, setSolved] = useState<{
    boxes: Record<string, Box>;
    naturals: Record<string, { w: number; h: number }>;
  } | null>(null);
  const ruleKey = `${design.id}|${W}|${H}|${fit}|${item?.id ?? ''}|${rules.length}`;
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
      const o = naturalOrigin(p.frame, W, H, w, h);
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
  }, [rules.length, design.id]);

  // A frame with a size (`sizing` fixed, min or fill) is the part's own size: the part fills it.
  const sized = (f: Frame): boolean => f.w !== null || f.h !== null;

  const placement = (p: Placed): CSSProperties => {
    const box = solved?.boxes[p.id];
    const css: CSSProperties = {
      ...frameCss(p.frame, W, H, designed),
      ...(sized(p.frame) ? { display: 'flex' } : {}),
    };
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

  // ---- the layers of `presentation.stack` ------------------------------------------------------------------
  const z = (layer: string): number | undefined => pres.stack.find((s) => s.layer === layer)?.zIndex;
  const r = pres.cornerRadiiFrac;
  const radius = `${r.topLeft * W}px ${r.topRight * W}px ${r.bottomRight * W}px ${r.bottomLeft * W}px`;
  const bgSrc = pres.backgroundImage
    ? pres.backgroundImage.source === 'content'
      ? imageFor(item, pres.contentImageAspect)
      : pres.backgroundImage.url
    : null;
  const inset = pres.insetImage;
  const insetSrc = inset
    ? inset.source === 'content'
      ? imageFor(item, pres.contentImageAspect)
      : inset.url
    : null;
  const shade = pres.shadeGradient ?? pres.gradient?.css ?? null;
  const shadows = (pres.shadows ?? []).map(
    (s) =>
      `${s.kind === 'inner' ? 'inset ' : ''}${s.xPx}px ${s.yPx}px ${s.blurPx}px ${s.spreadPx}px ${withAlpha(s.color, s.opacity / 100)}`,
  );
  const style = design.style as Record<string, string | boolean | undefined> | undefined;
  const rankStyle = style?.indexNumber && rank !== undefined ? rankNumeralCss(style) : null;
  const behind = style?.indexNumberLayer === 'back';
  const numeral = rankStyle && (
    <div aria-hidden style={{ position: 'absolute', zIndex: behind ? -1 : undefined, ...rankStyle }}>
      {rank}
    </div>
  );

  const open = () => item && onOpen?.(item);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };
  const interactive = Boolean(onOpen && item);

  return (
    <Root
      ref={rootRef}
      $radius={radius}
      $focus={pres.focus}
      style={{ width: W, height: H }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={item?.title}
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
          boxShadow: shadows.length ? shadows.join(', ') : undefined,
          clipPath: pres.clipPath ?? undefined,
        }}
      >
        {pres.backgroundGradient && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: z('background'),
              background: pres.backgroundGradient.css,
            }}
          />
        )}
        {bgSrc && (
          <img
            src={bgSrc}
            alt=""
            draggable={false}
            loading={priority ? 'eager' : 'lazy'}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              ...pictureFitCss(pres.backgroundImage),
              zIndex: z('background'),
            }}
          />
        )}
        {inset && insetSrc && (
          <img
            src={insetSrc}
            alt=""
            draggable={false}
            loading={priority ? 'eager' : 'lazy'}
            style={{
              position: 'absolute',
              left: inset.leftPx,
              top: inset.topPx,
              width: inset.widthPx,
              height: inset.heightPx,
              ...pictureFitCss(inset),
              clipPath: inset.clipPath ?? undefined,
              zIndex: z('insetImage'),
            }}
          />
        )}
        {shade && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: z('shade'),
              background: shade,
              pointerEvents: 'none',
            }}
          />
        )}
        {pres.border && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: z('outline'),
              pointerEvents: 'none',
              borderRadius: radius,
              ...borderCss(pres.border),
            }}
          />
        )}
        {item &&
          placed.map((p) => (
            <div key={p.id} data-item-id={p.id} style={{ ...placement(p), zIndex: p.z }}>
              {p.el ? (
                <ElementView
                  el={p.el}
                  ctx={ctx}
                  inFrame
                  style={sized(p.frame) ? { flex: '1 1 auto' } : undefined}
                />
              ) : (
                <CompositeView comp={p.comp!} ctx={ctx} hasFrameWidth={p.frame.w !== null} />
              )}
            </div>
          ))}
      </div>
      {!behind && numeral}
    </Root>
  );
}

/**
 * The rank numeral as the card's `style` says: its colour and how it is painted (solid, outline,
 * gradient). The JSON sends no size, font, place or stroke width for it, so none is set here.
 */
function rankNumeralCss(style: Record<string, string | boolean | undefined>): CSSProperties {
  const color = typeof style.indexNumberColor === 'string' ? style.indexNumberColor : undefined;
  switch (style.indexNumberStyle) {
    case 'outline':
      return { color: 'transparent', WebkitTextStrokeColor: color } as CSSProperties;
    case 'gradient':
      return {
        backgroundImage: `linear-gradient(180deg, ${style.indexNumberGradientFrom}, ${style.indexNumberGradientTo})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      } as CSSProperties;
    default:
      return { color };
  }
}
