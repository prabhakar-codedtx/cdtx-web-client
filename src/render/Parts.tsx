import type { CSSProperties, ReactNode } from 'react';
import type { CardElement, ElementProps, Subview, TitleItem } from '@/lib/api/types';
import { assetUrl } from '@/lib/api/endpoints';
import { itemText, metaSegments, pictureField } from '@/lib/render/fields';
import { px } from '@/lib/render/units';

/**
 * The parts a card is made of, each drawn only from its JSON. A length is the design's px times the
 * part's own `scale` times the card's `fit` (`u` below); a colour, a text and a picture are read as sent.
 */

export interface PartCtx {
  item: TitleItem | null;
  /** The card's `fit` (how much smaller than designed it is drawn). */
  fit: number;
  /** Aspect of the title's picture the card asks for (`presentation.contentImageAspect`). */
  aspect: string;
  /** A tap on a part that has an `action` (play, like, watchlist ...). */
  onAction?: (action: string, item: TitleItem | null) => void;
}

const unit = (el: CardElement, ctx: PartCtx): number => (el.scale ?? 1) * ctx.fit;

/**
 * One length to draw: the final one the server sent (times the card's `fit`), else the design's px
 * times the part's `scale` (a server that does not send final sizes yet).
 */
function len(
  final: number | undefined,
  design: number | undefined,
  el: CardElement,
  ctx: PartCtx,
): number | undefined {
  if (final !== undefined) return final * ctx.fit;
  return design === undefined ? undefined : design * unit(el, ctx);
}

const FLEX: Record<string, string> = {
  start: 'flex-start',
  top: 'flex-start',
  center: 'center',
  middle: 'center',
  end: 'flex-end',
  bottom: 'flex-end',
  between: 'space-between',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
  stretch: 'stretch',
};
/** The JSON's alignment as CSS; absent when the JSON sends none. */
export const flexOf = (v: string | undefined): string | undefined => (v ? FLEX[v] : undefined);

// ---- icons ------------------------------------------------------------------------------------

function IconPart({ sv, size, color }: { sv: Subview; size: number | undefined; color?: string }) {
  const file = sv.iconAsset?.svg ?? sv.iconSvgUrl;
  const src = file ? assetUrl(file) : undefined;
  if (!src) return null;
  const tintable = sv.iconAsset ? sv.iconAsset.tintable : true;
  if (!tintable) return <img src={src} alt="" style={{ width: size, height: size }} />;
  // A tintable icon is drawn in its JSON colour through the SVG's shape.
  const mask = `url("${src}") center / contain no-repeat`;
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMask: mask,
        mask,
      }}
    />
  );
}

// ---- a box with icon / text / slider layers (a button, a badge) --------------------------------

function renderSubviews(el: CardElement, ctx: PartCtx): ReactNode[] {
  const subviews = [...(el.properties.subviews ?? [])];
  const order = (s: Subview) => (s.side === 'left' ? 0 : s.side === 'right' ? 2 : 1);
  subviews.sort((a, b) => order(a) - order(b));
  return subviews.map((sv, i) => {
    if (sv.kind === 'icon') {
      return (
        <IconPart
          key={i}
          sv={sv}
          size={len(sv.drawSizePx, sv.renderSize ?? sv.size, el, ctx)}
          color={sv.renderColor}
        />
      );
    }
    if (sv.kind === 'text') {
      const t = sv.renderTypography ?? {};
      const text = sv.bind ? itemText(ctx.item, sv.bind) : (sv.renderText ?? '');
      return (
        <span
          key={i}
          style={{
            color: sv.renderColor,
            fontFamily: t.fontFamily,
            fontSize: len(sv.drawFontSizePx, t.fontSize, el, ctx),
            fontWeight: t.fontWeight,
            letterSpacing: len(sv.drawLetterSpacingPx, t.letterSpacing, el, ctx),
            lineHeight: t.lineHeightPct !== undefined ? `${t.lineHeightPct}%` : undefined,
            textTransform: textTransform(t.textCase),
          }}
        >
          {text}
        </span>
      );
    }
    if (sv.kind === 'slider') {
      // The track at its JSON height, least width, corner and colour (it grows to fill its box);
      // the fill is `staticValue` percent of it, cut to the track's corners.
      const value = sv.staticValue ?? 0;
      const corner = len(sv.drawCornerPx, undefined, el, ctx);
      return (
        <span
          key={i}
          style={{
            display: 'block',
            flexGrow: 1,
            height: len(sv.drawHeightPx, sv.height, el, ctx),
            minWidth: len(sv.drawMinWidthPx, undefined, el, ctx),
            borderRadius: corner,
            overflow: corner ? 'hidden' : undefined,
            background: sv.renderTrackColor,
          }}
        >
          <span
            style={{
              display: 'block',
              height: '100%',
              width: `${Math.max(0, Math.min(100, value))}%`,
              background: sv.renderFillColor,
            }}
          />
        </span>
      );
    }
    return null;
  });
}

/**
 * A placed part's own size (`px.width`/`height`, `px.minWidth`/`minHeight`), times the card's `fit`.
 * The sizes are the part's outer box (its frame), so padding and border sit inside them.
 */
function sizeCss(el: CardElement, ctx: PartCtx): CSSProperties {
  const f = el.px;
  const at = (v: number | undefined) => (v === undefined ? undefined : v * ctx.fit);
  const css: CSSProperties = {
    width: at(f?.width),
    height: at(f?.height),
    minWidth: at(f?.minWidth),
    minHeight: at(f?.minHeight),
  };
  const sized = Object.values(css).some((v) => v !== undefined);
  return sized ? { ...css, boxSizing: 'border-box' } : {};
}

function boxStyle(el: CardElement, ctx: PartCtx): CSSProperties {
  const p = el.properties;
  const r = p.render;
  const fx = el.px;
  const width = len(fx?.borderWidth, r?.borderWidthPx, el, ctx);
  // The JSON sends a colour and a width per side; a side with neither has no border.
  const side = (c: string | null | undefined) => (c && width ? `${width}px solid ${c}` : undefined);
  const pad = (final: number | undefined, design: number | undefined) => len(final, design, el, ctx);
  const bg = r?.background;
  return {
    // A flex box, not an inline one: inline, it would sit on a text line and gain the line's
    // descender space under it.
    display: 'flex',
    flexDirection: p.layoutDirection,
    justifyContent: flexOf(p.justify),
    alignItems: flexOf(p.verticalAlign),
    gap: len(fx?.gap, p.gap, el, ctx),
    paddingTop: pad(fx?.padding?.top, p.paddingTop),
    paddingRight: pad(fx?.padding?.right, p.paddingRight),
    paddingBottom: pad(fx?.padding?.bottom, p.paddingBottom),
    paddingLeft: pad(fx?.padding?.left, p.paddingLeft),
    opacity: p.opacity !== undefined ? p.opacity / 100 : undefined,
    backgroundColor: bg?.color ?? undefined,
    backgroundImage: bg?.imageUrl ? `url("${bg.imageUrl}")` : (bg?.gradient ?? undefined),
    borderTop: side(r?.border?.top),
    borderRight: side(r?.border?.right),
    borderBottom: side(r?.border?.bottom),
    borderLeft: side(r?.border?.left),
    borderRadius:
      el.corner?.px != null
        ? len(fx?.corner, el.corner.px, el, ctx)
        : el.corner?.pct != null
          ? `${el.corner.pct}%`
          : undefined,
    ...sizeCss(el, ctx),
  };
}

/**
 * A box of icon / text / slider layers. One with an `action` is tappable, but it is still a plain
 * box (not a `<button>`), so the browser adds no look of its own: everything shown is the JSON's.
 */
export function AtomBox({ el, ctx, style }: { el: CardElement; ctx: PartCtx; style?: CSSProperties }) {
  const content = renderSubviews(el, ctx);
  const css: CSSProperties = { ...boxStyle(el, ctx), ...style };
  if (el.action) {
    const act = (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      ctx.onAction?.(el.action!, ctx.item);
    };
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={el.name}
        data-action={el.action}
        onClick={act}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            act(e);
          }
        }}
        style={css}
      >
        {content}
      </div>
    );
  }
  return <div style={css}>{content}</div>;
}

// ---- text ---------------------------------------------------------------------------------------

/** The JSON's `textCase` as CSS (`none` / absent: the words as written). */
function textTransform(textCase: string | undefined): CSSProperties['textTransform'] {
  return textCase === 'uppercase' || textCase === 'lowercase' || textCase === 'capitalize'
    ? textCase
    : undefined;
}

/** A text part's line height: final px when sent, else a bare multiple of its font size. */
function lineHeightOf(el: CardElement, ctx: PartCtx): CSSProperties['lineHeight'] {
  if (el.px?.lineHeight !== undefined) return `${el.px.lineHeight * ctx.fit}px`;
  const v = el.properties.lineHeight;
  if (typeof v === 'number') return v;
  return typeof v === 'string' && v.trim() !== '' && !v.trim().endsWith('px') ? v : undefined;
}

export function TextPart({ el, ctx, style }: { el: CardElement; ctx: PartCtx; style?: CSSProperties }) {
  const p = el.properties;
  const text = el.bind ? itemText(ctx.item, el.bind) : (el.text ?? '');
  if (!text) return null;
  const size = len(el.px?.fontSize, px(p.fontSize), el, ctx);
  const clamp = typeof p.lineClamp === 'number' && p.lineClamp > 0 ? p.lineClamp : undefined;
  const shadow = (p.textShadows ?? [])
    .map((s) => `${s.xPx * ctx.fit}px ${s.yPx * ctx.fit}px ${s.blurPx * ctx.fit}px ${s.color}`)
    .join(', ');
  return (
    <div
      style={{
        color: p.textColor,
        fontFamily: p.fontFamily,
        fontSize: size,
        fontWeight: p.fontWeight as CSSProperties['fontWeight'],
        textAlign: p.textAlign as CSSProperties['textAlign'],
        textTransform: textTransform(p.textCase),
        letterSpacing: len(el.px?.letterSpacing, px(p.letterSpacing), el, ctx),
        lineHeight: lineHeightOf(el, ctx),
        textShadow: shadow || undefined,
        ...sizeCss(el, ctx),
        ...(clamp
          ? {
              display: '-webkit-box',
              WebkitLineClamp: clamp,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }
          : {}),
        ...style,
      }}
    >
      {text}
    </div>
  );
}

// ---- the metadata line -----------------------------------------------------------------------

export function MetaRow({ el, ctx, style }: { el: CardElement; ctx: PartCtx; style?: CSSProperties }) {
  const p: ElementProps = el.properties;
  const segments = metaSegments(p, ctx.item);
  if (segments.length === 0) return null;
  const size = len(el.px?.fontSize, px(p.fontSize), el, ctx);
  const gap = len(el.px?.metaGap, p.metaGapPx, el, ctx);
  return (
    <div
      style={{
        display: 'flex',
        columnGap: gap,
        color: p.textColor,
        fontSize: size,
        fontWeight: p.fontWeight as CSSProperties['fontWeight'],
        ...sizeCss(el, ctx),
        ...style,
      }}
    >
      {segments.map((s, i) => (
        <span key={s.key} style={{ display: 'inline-flex', columnGap: gap }}>
          {i > 0 && s.display !== 'badge' && segments[i - 1]!.display !== 'badge' && p.metaSeparator ? (
            <span aria-hidden>{p.metaSeparator}</span>
          ) : null}
          {/* A badge is the value on its colour; the JSON sends no other badge look. */}
          {s.display === 'badge' ? (
            <span style={{ background: s.color }}>{s.value}</span>
          ) : (
            <span style={{ color: s.color }}>{s.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ---- a picture -----------------------------------------------------------------------------------

/** `fit` as CSS: `width` / `height` fit that side and keep the picture's own ratio. */
function fitCss(fit: string): CSSProperties {
  if (fit === 'cover' || fit === 'contain' || fit === 'fill') return { objectFit: fit };
  if (fit === 'width') return { width: '100%', height: 'auto' };
  if (fit === 'height') return { height: '100%', width: 'auto' };
  return {};
}

const CORNER: Record<string, string> = {
  topLeft: 'borderTopLeftRadius',
  topRight: 'borderTopRightRadius',
  bottomRight: 'borderBottomRightRadius',
  bottomLeft: 'borderBottomLeftRadius',
  'top-left': 'borderTopLeftRadius',
  'top-right': 'borderTopRightRadius',
  'bottom-right': 'borderBottomRightRadius',
  'bottom-left': 'borderBottomLeftRadius',
};

/** `radiusFrac` on the corners `roundedCorners` names (none named: every corner). */
function cornersCss(view: NonNullable<CardElement['image']>): CSSProperties {
  if (!(view.radiusFrac > 0)) return {};
  const r = `${view.radiusFrac * 100}%`;
  const named = (view.roundedCorners ?? []).map((c) => CORNER[c]).filter(Boolean) as string[];
  if (named.length === 0) return { borderRadius: r };
  return Object.fromEntries(named.map((k) => [k, r])) as CSSProperties;
}

/** A picture part: the title's own picture (a field the JSON names) or a fixed address. */
export function ImagePart({
  el,
  ctx,
  fillFrame,
  style,
}: {
  el: CardElement;
  ctx: PartCtx;
  /** In a frame the part fills it; in a flow it takes the size its settings say. */
  fillFrame: boolean;
  style?: CSSProperties;
}) {
  const view = el.image!;
  const src = view.source === 'content' ? pictureField(ctx.item, view.contentField, ctx.aspect) : view.url;
  if (!src) return null;
  const p = el.properties;
  const w = len(el.px?.width, p.customWidthPx, el, ctx);
  const h = len(el.px?.height, p.customHeightPx, el, ctx);
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        objectPosition: `${view.alignH} ${view.alignV}`,
        opacity: view.opacity,
        aspectRatio: view.aspectRatio ?? undefined,
        ...(fillFrame
          ? { width: '100%', height: '100%' }
          : view.fillWidth
            ? { width: '100%', height: h }
            : { width: w, height: h }),
        ...fitCss(view.fit),
        ...cornersCss(view),
        ...style,
      }}
    />
  );
}

// ---- one part, whatever it is --------------------------------------------------------------------

/** Which kind of part this is, from its JSON: a metadata line, a picture, a box with layers, or text. */
export function ElementView({
  el,
  ctx,
  inFrame,
  style,
}: {
  el: CardElement;
  ctx: PartCtx;
  inFrame: boolean;
  style?: CSSProperties;
}) {
  if (el.hidden) return null;
  if (el.type === 'meta-row') return <MetaRow el={el} ctx={ctx} style={style} />;
  if (el.image)
    return <ImagePart el={el} ctx={ctx} fillFrame={inFrame && Boolean(el.frame?.w)} style={style} />;
  if ((el.properties.subviews?.length ?? 0) > 0) return <AtomBox el={el} ctx={ctx} style={style} />;
  return <TextPart el={el} ctx={ctx} style={style} />;
}
