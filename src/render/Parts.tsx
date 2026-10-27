import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Atom, IconFiles, Layer, Title } from '@/lib/api/types';
import { assetUrl } from '@/lib/api/endpoints';
import { imageSrc, metaSegments, shown, titleText } from '@/lib/render/fields';
import { fillCss, objectFitCss, paddingCss, rgba, strokeCss, textCss } from '@/lib/render/paint';

/**
 * The atoms a card is made of, each drawn only from its JSON (`atom.type`: text, box, meta, image).
 * Every length in `style` is final for the designed card; it is drawn times the card's `fit` (`k`).
 * A colour, a text and a picture are read as sent.
 */

export interface PartCtx {
  title: Title | null;
  /** The card's `fit` (how much smaller or bigger than designed it is drawn). */
  fit: number;
  /** The drawn card's width: what `cornerRadiusFrac` is a fraction of. */
  cardW: number;
  /** Which of the title's pictures the card shows (`card.imageAspect`). */
  aspect: string | null;
  /** A tap on an atom that has an `action` (play, more_info, watchlist ...). */
  onAction?: (action: string, title: Title | null) => void;
  /** A rail's header or footer: the rail's own title, for a text bound to `railTitle`. */
  railTitle?: string | null;
}

const FLEX: Record<string, string> = {
  start: 'flex-start',
  top: 'flex-start',
  left: 'flex-start',
  center: 'center',
  middle: 'center',
  end: 'flex-end',
  bottom: 'flex-end',
  right: 'flex-end',
  between: 'space-between',
  'space-between': 'space-between',
  'space-around': 'space-around',
  'space-evenly': 'space-evenly',
  stretch: 'stretch',
};
/** The JSON's alignment as CSS; nothing when the JSON sends none. */
export const flexOf = (v: string | null | undefined): string | undefined => (v ? FLEX[v] : undefined);

const times = (v: number | null | undefined, k: number): number | undefined =>
  v === null || v === undefined ? undefined : v * k;

/** An atom is drawn only when the title has its badge and it has something to show. */
export function isDrawn(atom: Atom, title: Title | null, aspect: string | null = null): boolean {
  if (!shown(atom, title)) return false;
  if (atom.type === 'text') return Boolean(atomText(atom, title) || logoOf(atom, title));
  if (atom.type === 'meta') return atom.style.meta ? metaSegments(atom.style.meta, title).length > 0 : false;
  // A picture is looked up in the card's own shape (`imageAspect`), as it is when drawn.
  if (atom.type === 'image') return Boolean(imageOf(atom, title, aspect));
  if (atom.type === 'box') {
    // A box that only shows title fields (a Year, a Language, a Genre) has nothing to draw when the
    // title has none of them; one with an icon, a bar or fixed words always draws.
    const layers = atom.style.layers;
    const fields =
      layers.length > 0 && layers.every((l) => l.type === 'text' && l.bind && l.bind !== 'railTitle');
    return fields ? layers.some((l) => titleText(title, l.bind) !== '') : true;
  }
  return false;
}

const atomText = (atom: Atom, title: Title | null): string =>
  atom.bind ? titleText(title, atom.bind) : (atom.staticText ?? '');

const logoOf = (atom: Atom, title: Title | null): string | null =>
  atom.showLogoWhenAvailable && title?.logoUrl ? title.logoUrl : null;

/** An image atom's picture: the title key `bind` names, else its `style.image`. */
function imageOf(atom: Atom, title: Title | null, aspect: string | null): string | null {
  if (atom.bind) {
    const v = title?.[atom.bind];
    return typeof v === 'string' && v ? v : null;
  }
  return imageSrc(atom.style.image, title, aspect);
}

// ---- icons ------------------------------------------------------------------------------------

function Icon({
  files,
  size,
  color,
}: {
  files: IconFiles | null;
  size: number | undefined;
  color: string | undefined;
}) {
  const src = files?.svg ? assetUrl(files.svg) : undefined;
  if (!src) return null;
  // `as-is`: the file is already painted in its colour; `tint`: painted the layer's colour here.
  if (files!.draw !== 'tint')
    return <img src={src} alt="" draggable={false} style={{ width: size, height: size }} />;
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

// ---- a box: a button, a pill, a badge --------------------------------------------------------

function layerView(layer: Layer, i: number, ctx: PartCtx, focusColor: string | null): ReactNode {
  const k = ctx.fit;
  const color = rgba(focusColor ?? layer.color);
  if (layer.type === 'icon') {
    if (layer.emoji)
      return (
        <span key={i} style={{ fontSize: times(layer.size, k), lineHeight: 1 }}>
          {layer.emoji}
        </span>
      );
    const files = focusColor && layer.focusIcon ? layer.focusIcon : layer.icon;
    return <Icon key={i} files={files} size={times(layer.size, k)} color={color} />;
  }
  if (layer.type === 'text') {
    const text = layer.bind
      ? layer.bind === 'railTitle'
        ? (ctx.railTitle ?? '')
        : titleText(ctx.title, layer.bind)
      : (layer.staticText ?? '');
    if (!text) return null;
    return (
      <span key={i} style={{ ...textCss(layer.text, k), ...(color ? { color } : {}) }}>
        {text}
      </span>
    );
  }
  if (layer.type === 'slider' && layer.slider) {
    const s = layer.slider;
    // 0-1; a value above 1 is a percent (known data issue).
    const v = s.value ?? 0;
    const frac = Math.max(0, Math.min(1, v > 1 ? v / 100 : v));
    const corner = times(s.cornerRadius, k);
    return (
      <span
        key={i}
        style={{
          display: 'block',
          flexGrow: 1,
          height: times(s.height, k),
          minWidth: times(s.minWidth, k),
          borderRadius: corner,
          overflow: corner ? 'hidden' : undefined,
          background: rgba(s.trackColor),
        }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${frac * 100}%`,
            background: rgba(s.progressColor),
          }}
        />
      </span>
    );
  }
  return null;
}

/** The size `style.layout` gives an atom (its outer box), times `k`. */
function sizeCss(atom: Atom, k: number): CSSProperties {
  const l = atom.style.layout;
  const css: CSSProperties = {
    width: times(l.width, k),
    height: times(l.height, k),
    minWidth: times(l.minWidth, k),
    minHeight: times(l.minHeight, k),
  };
  return Object.values(css).some((v) => v !== undefined) ? { ...css, boxSizing: 'border-box' } : {};
}

function BoxPart({ atom, ctx, style }: { atom: Atom; ctx: PartCtx; style?: CSSProperties }) {
  const [focused, setFocused] = useState(false);
  const k = ctx.fit;
  const { layout, box } = atom.style;
  const order = (l: Layer) => (l.side === 'left' ? 0 : l.side === 'right' ? 2 : 1);
  const layers = [...atom.style.layers].sort((a, b) => order(a) - order(b));
  // TV: the atom's own focus look (`atom.focus`), and each layer's `focusColor` / `focusIcon`.
  const f = focused ? atom.focus : null;
  const css: CSSProperties = {
    // A flex box, not an inline one: inline, it would sit on a text line and gain its descender space.
    display: 'flex',
    flexDirection: layout.direction === 'column' ? 'column' : 'row',
    justifyContent: flexOf(layout.justify),
    alignItems: flexOf(layout.align),
    gap: times(layout.gap, k),
    ...paddingCss(layout.padding, k),
    ...sizeCss(atom, k),
    ...fillCss(f?.background ?? box.background),
    ...strokeCss(f?.border ?? box.border, k),
    borderRadius: times(box.cornerRadius, k),
    opacity: box.opacity,
    ...(atom.focus
      ? { transition: 'transform 150ms', transform: f?.scale ? `scale(${f.scale})` : undefined }
      : {}),
    ...style,
  };
  const content = layers.map((l, i) => layerView(l, i, ctx, f ? (l.focusColor ?? f.color) : null));
  if (!atom.action) return <div style={css}>{content}</div>;
  const act = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    ctx.onAction?.(atom.action!, ctx.title);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={atom.staticText ?? atom.action}
      data-action={atom.action}
      onClick={act}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          act(e);
        }
      }}
      onFocus={atom.focus ? () => setFocused(true) : undefined}
      onBlur={atom.focus ? () => setFocused(false) : undefined}
      style={{ ...css, outline: atom.focus ? 'none' : undefined }}
    >
      {content}
    </div>
  );
}

// ---- text --------------------------------------------------------------------------------------

function TextPart({ atom, ctx, style }: { atom: Atom; ctx: PartCtx; style?: CSSProperties }) {
  const k = ctx.fit;
  // The title's logo instead of its name, in a `titleSlot`-high box, when it has one.
  const logo = logoOf(atom, ctx.title);
  if (logo)
    return (
      <img
        src={logo}
        alt={ctx.title?.title ?? ''}
        draggable={false}
        style={{
          height: times(atom.titleSlot, k),
          maxWidth: '100%',
          objectFit: 'contain',
          objectPosition: 'left center',
          ...style,
        }}
      />
    );
  const text = atomText(atom, ctx.title);
  if (!text) return null;
  return (
    <div
      style={{
        ...textCss(atom.style.text, k),
        ...paddingCss(atom.style.layout.padding, k),
        ...sizeCss(atom, k),
        ...fillCss(atom.style.box.background),
        borderRadius: times(atom.style.box.cornerRadius, k),
        opacity: atom.style.box.opacity,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

// ---- the metadata line -------------------------------------------------------------------------

function MetaPart({ atom, ctx, style }: { atom: Atom; ctx: PartCtx; style?: CSSProperties }) {
  const meta = atom.style.meta;
  if (!meta) return null;
  const segments = metaSegments(meta, ctx.title);
  if (segments.length === 0) return null;
  const k = ctx.fit;
  const gap = times(meta.gap, k);
  // A line of fields: the text style without its line cut (each field is kept whole).
  const text = textCss(atom.style.text ? { ...atom.style.text, maxLines: null } : null, k);
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: gap,
        ...text,
        ...sizeCss(atom, k),
        ...style,
      }}
    >
      {segments.map((s, i) => (
        <span key={s.key} style={{ display: 'inline-flex', columnGap: gap }}>
          {i > 0 && s.display !== 'badge' && segments[i - 1]!.display !== 'badge' && meta.separator ? (
            <span aria-hidden>{meta.separator}</span>
          ) : null}
          {/* A badge is the value on its colour; the JSON sends no other badge look. */}
          {s.display === 'badge' ? (
            <span style={{ background: rgba(s.color) }}>{s.value}</span>
          ) : (
            <span style={{ color: rgba(s.color) }}>{s.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ---- a picture ---------------------------------------------------------------------------------

const CORNER: Record<string, string> = {
  'top-left': 'borderTopLeftRadius',
  'top-right': 'borderTopRightRadius',
  'bottom-right': 'borderBottomRightRadius',
  'bottom-left': 'borderBottomLeftRadius',
  topLeft: 'borderTopLeftRadius',
  topRight: 'borderTopRightRadius',
  bottomRight: 'borderBottomRightRadius',
  bottomLeft: 'borderBottomLeftRadius',
};

function ImagePart({
  atom,
  ctx,
  fillFrame,
  style,
}: {
  atom: Atom;
  ctx: PartCtx;
  /** In a sized frame the picture fills it; in a flow it takes the size its style says. */
  fillFrame: boolean;
  style?: CSSProperties;
}) {
  const view = atom.style.image;
  const src = imageOf(atom, ctx.title, ctx.aspect);
  if (!src) return null;
  const k = ctx.fit;
  const l = atom.style.layout;
  // `cornerRadiusFrac` is of the card's width, on the corners `roundedCorners` lists (none: all).
  const r = view?.cornerRadiusFrac ? view.cornerRadiusFrac * ctx.cardW : 0;
  const named = (view?.roundedCorners ?? []).map((c) => CORNER[c]).filter(Boolean) as string[];
  const corners: CSSProperties = !r
    ? {}
    : named.length
      ? Object.fromEntries(named.map((c) => [c, r]))
      : { borderRadius: r };
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        display: 'block',
        boxSizing: 'border-box',
        ...objectFitCss(view),
        opacity: view?.opacity,
        aspectRatio: view?.aspectRatio ?? undefined,
        ...(fillFrame
          ? { width: '100%', height: '100%' }
          : view?.fillWidth
            ? { width: '100%', height: times(l.height, k) }
            : { width: times(l.width, k), height: times(l.height, k) }),
        ...strokeCss(view?.border, k),
        ...corners,
        ...style,
      }}
    />
  );
}

// ---- one atom, whatever it is ------------------------------------------------------------------

/** Draws one atom by its `type`; one the title does not show (a badge it lacks) is not drawn at all. */
export function AtomView({
  atom,
  ctx,
  inFrame,
  style,
}: {
  atom: Atom;
  ctx: PartCtx;
  inFrame: boolean;
  style?: CSSProperties;
}) {
  if (!shown(atom, ctx.title)) return null;
  switch (atom.type) {
    case 'text':
      return <TextPart atom={atom} ctx={ctx} style={style} />;
    case 'box':
      return <BoxPart atom={atom} ctx={ctx} style={style} />;
    case 'meta':
      return <MetaPart atom={atom} ctx={ctx} style={style} />;
    case 'image':
      return <ImagePart atom={atom} ctx={ctx} fillFrame={inFrame && atom.frame?.w != null} style={style} />;
    default:
      // An unknown kind: draw nothing.
      return null;
  }
}
