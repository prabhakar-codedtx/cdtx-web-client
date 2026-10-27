/**
 * The delivery API's JSON in schema 3 (the server's default since 24 Oct 2026), as the client reads
 * it. Every key is always sent (`null` / `[]` when there is nothing); every length is final, in
 * `page.device.unit` (px on the web); fractions are of the drawn card. The client draws only from
 * this: no design value, size or text lives in the client.
 *
 * Reference: `docs/client-contract/SCHEMA-3-KEYS.md`, `KEYS-EXPLAINED.md` and `RENDERING-GUIDE.md`
 * in the CMS repo. An unknown key is ignored; an unknown enum value falls back to the safest one.
 */

export interface Envelope<T> {
  header: {
    code: number;
    message: string;
    start: number | null;
    rows: number | null;
    count: number | null;
    tracking_id: string;
  };
  data: T[];
}

/** The request context every call carries. */
export interface DeliveryContext {
  reg: string;
  locale: string;
  dt: string;
}

// ---- launch config (not inside the envelope) -------------------------------------------------

export interface LaunchSetting {
  key: string;
  type: 'String' | 'Number' | 'Boolean' | 'Json';
  value: unknown;
}

export interface LaunchConfig {
  config: LaunchSetting[];
  geo: { country: string; group: string; ip: string };
  trackingId: string;
}

// ---- Design System (`GET {designSystemURL}`) -------------------------------------------------

export interface ThemeFont {
  key: string;
  name: string;
  family: string;
  source: string;
  stack: string;
  cssUrl: string | null;
}

export interface Theme {
  version: string;
  product: string;
  device: { dt: string; deviceClass: string; unit: string; unitScale: number };
  fonts: ThemeFont[];
  /** The font of any text whose `fontFamily` is null. */
  defaultFontFamily: string | null;
  /** The Design System's colours: `key` (`primary`, `background`, `text-primary`...) and its `value`. */
  colors?: { key: string; name?: string; group?: string; value: string }[];
}

// ---- navigation ------------------------------------------------------------------------------

export interface NavPage {
  slug: string;
  title: string | null;
  icon: string | null;
  position: number | null;
  isDefault: boolean;
  version: number | null;
  versionLabel: string | null;
  publishedAt: string | null;
  /** The page call, complete (relative to the API host). */
  url: string | null;
}

// ---- titles (`GET rail.source.contentUrl`) ---------------------------------------------------

export interface TitleImage {
  /** `0-2x3`, `0-16x9`…; null = the main picture. */
  aspect: string | null;
  url: string | null;
  fallback: boolean;
}

export type BadgeKey =
  | 'top10'
  | 'new'
  | 'recentlyAdded'
  | 'newEpisode'
  | 'leavingSoon'
  | 'uhd4k'
  | 'hdr'
  | 'dolbyVision'
  | 'dolbyAtmos'
  | 'free'
  | 'premium'
  | 'live'
  | 'exclusive'
  | 'original';

/** What the player offers for one title (`GET /v1/content/{id}`): only what the title really has. */
export interface Playback {
  renditions: { id: string; label: string; height: number | null; bitrateKbps: number | null; url: string }[];
  audioTracks: { id: string; language: string; label: string; detail: string | null; url: string | null }[];
  subtitles: { id: string; language: string; label: string; kind: string; url: string | null }[];
  intro: { start: number; end: number } | null;
}

/** One title of a rail. An atom's `bind` and a meta row's `fields` name these keys. */
export interface Title {
  id: string;
  slug: string | null;
  type: string | null;
  title: string | null;
  description: string | null;
  releaseYear: number | null;
  durationSeconds: number | null;
  rating: string | null;
  genres: string[];
  languages: string[];
  videoQuality: string[];
  audioQuality: string[];
  episodeLabel: string | null;
  badges: Record<BadgeKey, boolean>;
  images: TitleImage[];
  logoUrl: string | null;
  previewVideoUrl: string | null;
  availableUntil: string | null;
  entitlements: unknown;
  /** Only on a title asked for by id (`GET /v1/content/{id}`), not on a rail's titles. */
  playback?: Playback;
  [key: string]: unknown;
}

// ---- shared shapes ---------------------------------------------------------------------------

export interface Point {
  x: number | null;
  y: number | null;
}

export interface Sides {
  top: number | null;
  right: number | null;
  bottom: number | null;
  left: number | null;
}

export interface GradientStop {
  color: string | null;
  opacity: number | null;
  at: number | null;
}

/** CSS degrees: 0 bottom to top, 90 left to right, 180 top to bottom. */
export interface Gradient {
  angle: number | null;
  stops: GradientStop[];
}

/** A picture: `fixed` draws `url`; `content` the title's picture (`field`, else by `card.imageAspect`). */
export interface Image {
  source: 'fixed' | 'content' | string | null;
  url: string | null;
  field: string | null;
  fit: 'cover' | 'contain' | 'fill' | 'width' | 'height' | string | null;
  alignX: 'left' | 'center' | 'right' | string | null;
  alignY: 'top' | 'center' | 'bottom' | string | null;
}

/** What is painted behind something. `type` says which key is in use. */
export interface Fill {
  type: 'color' | 'gradient' | 'image' | string | null;
  color: string | null;
  gradient: Gradient | null;
  image: Image | null;
  /** 0-1 of black over an image. */
  scrim: number | null;
  /** Shown while an image loads, or when it cannot. */
  fallbackColor: string | null;
}

/** `sides` [] = all four. */
export interface Stroke {
  width: number | null;
  color: string | null;
  sides: string[];
}

export interface Shadow {
  type: 'drop' | 'inner' | string | null;
  x: number | null;
  y: number | null;
  blur: number | null;
  spread: number | null;
  color: string | null;
}

/** `lineHeight` is a multiple of `fontSize`; `fontFamily` null = the Design System's default. */
export interface TextStyle {
  fontFamily: string | null;
  fontSize: number | null;
  fontWeight: number | null;
  lineHeight: number | null;
  letterSpacing: number | null;
  color: string | null;
  align: 'left' | 'center' | 'right' | string | null;
  textCase: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | string | null;
  maxLines: number | null;
  shadows: Shadow[];
}

// ---- a block: one card design ----------------------------------------------------------------

/** Fractions (0-1) of the drawn card: the `pivot` point of the box sits on (`cx`, `cy`). */
export interface Frame {
  cx: number | null;
  cy: number | null;
  pivot: Point;
  sizing: 'fixed' | 'min' | 'hug' | 'fill' | string | null;
  w: number | null;
  h: number | null;
  /** Hug only: the widest it may be, as a share of the card's width. */
  maxW: number | null;
  pinned: string[];
}

export interface IconFiles {
  /** `as-is`: the file is already painted; `tint`: paint it the layer's `color`. */
  draw: 'as-is' | 'tint' | string | null;
  svg: string | null;
  vectorDrawable: string | null;
  png: { density: string; url: string }[];
}

export interface Slider {
  /** 0-1 (a value above 1 is a percent: known data issue). */
  value: number | null;
  trackColor: string | null;
  progressColor: string | null;
  height: number | null;
  minWidth: number | null;
  cornerRadius: number | null;
}

/** One layer of a box atom, in drawing order. */
export interface Layer {
  type: 'icon' | 'text' | 'slider' | string | null;
  side: 'left' | 'right' | string | null;
  bind: string | null;
  staticText: string | null;
  color: string | null;
  size: number | null;
  emoji: string | null;
  icon: IconFiles | null;
  text: TextStyle | null;
  slider: Slider | null;
  focusColor: string | null;
  focusIcon: IconFiles | null;
}

export interface LayoutStyle {
  direction: 'row' | 'column' | string | null;
  justify: string | null;
  align: 'top' | 'middle' | 'bottom' | string | null;
  gap: number | null;
  padding: Sides;
  width: number | null;
  height: number | null;
  minWidth: number | null;
  minHeight: number | null;
}

export interface BoxStyle {
  background: Fill | null;
  border: Stroke | null;
  cornerRadius: number | null;
  opacity: number;
}

export interface MetaStyle {
  fields: string[];
  separator: string | null;
  listSeparator: string | null;
  gap: number | null;
  fieldColors: Record<string, string>;
  fieldModes: Record<string, 'list' | 'count' | 'first' | string>;
  fieldDisplays: Record<string, 'text' | 'badge' | string>;
}

export interface ImageStyle extends Image {
  aspectRatio: number | null;
  fillWidth: boolean;
  /** Of the card's width, on the `roundedCorners` listed. */
  cornerRadiusFrac: number | null;
  roundedCorners: string[];
  opacity: number;
  border: Stroke | null;
}

export interface Style {
  layout: LayoutStyle;
  box: BoxStyle;
  text: TextStyle | null;
  meta: MetaStyle | null;
  image: ImageStyle | null;
  layers: Layer[];
}

/** TV: the look of an atom (a button) when the remote's focus is on it. */
export interface AtomFocus {
  scale: number | null;
  background: Fill | null;
  /** Its icons and text. */
  color: string | null;
  border: Stroke | null;
}

export interface Atom {
  id: string;
  type: 'box' | 'text' | 'meta' | 'image' | string;
  atomId: string | null;
  builtIn: string | null;
  slot: 'overlay' | 'image' | 'below' | 'flow' | string | null;
  zIndex: number | null;
  /** Null inside a component: its auto layout places it. */
  frame: Frame | null;
  /** Already applied to every length in `style`. */
  scale: number | null;
  action: string | null;
  bind: string | null;
  staticText: string | null;
  /** A badge key: drawn only when the title's `badges[key]` is true. */
  showWhen: BadgeKey | string | null;
  style: Style;
  relative: { fontSize: number | null; cornerRadius: number | null } | null;
  focus: AtomFocus | null;
  role: string | null;
  showLogoWhenAvailable: boolean;
  titleSlot: number | null;
}

export interface LayoutItem {
  type: 'element' | 'group' | string | null;
  id: string | null;
  direction: 'horizontal' | 'vertical' | string | null;
  gap: number | null;
  /** A group of facts in a row: drawn between the ones that show, with `gap` on each side. */
  separator?: string | null;
  items: LayoutItem[];
}

export interface AutoLayout {
  direction: 'horizontal' | 'vertical' | string | null;
  mainAxis: string | null;
  crossAxis: string | null;
  gap: number | null;
  rowGap: number | null;
  wrap: boolean;
  padding: Sides;
  width: { mode: 'hug' | 'fill' | 'fixed' | string | null; value: number | null };
  height: { mode: 'hug' | 'fill' | 'fixed' | string | null; value: number | null };
  items: LayoutItem[];
}

export interface Rule {
  id: string | null;
  item: string | null;
  attr: string | null;
  relation: string | null;
  target: string | null;
  targetAttr: string | null;
  multiplier: number | null;
  constant: number | null;
}

/** A group of atoms laid out as a row or column (`badge-group`: a corner's badge stack). */
export interface Component {
  id: string;
  type: string | null;
  sourceComponentId: string | null;
  slot: 'card' | 'beside' | 'below' | string | null;
  corner: string | null;
  zIndex: number | null;
  frame: Frame | null;
  atoms: Atom[];
  autoLayout: AutoLayout;
  layoutRules: Rule[];
}

export interface Card {
  /** The designed size: what `contentFit` and a `designed` rail draw at. */
  width: number | null;
  height: number | null;
  shape: 'rectangle' | 'ribbon' | string | null;
  /** The outline as fractions of the card; [] = a rectangle. */
  shapePolygon: Point[];
  display: 'card' | 'hero' | 'strip' | string | null;
  /** A hero: `width: screen`, `height: screen | ratio`. A strip: `width: lane`, `height: hug`. */
  stretch: { width: string | null; height: string | null } | null;
  /** A strip (a rail's header or footer that is not a card): how its parts are laid out. */
  strip?: {
    direction?: 'row' | 'column' | string | null;
    gap?: number | null;
    align?: string | null;
    distribute?: string | null;
    paddingX?: number | null;
    paddingY?: number | null;
  } | null;
  /** Which of a title's `images[]` the card shows. */
  imageAspect: string | null;
  background: Fill | null;
  insetImage:
    | (Image & {
        left: number | null;
        top: number | null;
        width: number | null;
        height: number | null;
        shapePolygon: Point[];
      })
    | null;
  /** Drawn over the picture, in order. */
  shade: Gradient[];
  border: Stroke | null;
  cornerRadiusFrac: {
    topLeft: number | null;
    topRight: number | null;
    bottomRight: number | null;
    bottomLeft: number | null;
  };
  shadows: Shadow[];
  focus: {
    scale: number | null;
    border: Stroke | null;
    glow: { blur: number | null; color: string | null; opacity: number | null } | null;
    durationMs: number | null;
  } | null;
  contentFit: { minScale: number | null; maxScale: number | null };
  stack: { layer: string; zIndex: number }[];
}

/** One card design, sent once per page and named by the rails (`blockKey`). */
export interface Block {
  id: string | null;
  card: Card;
  atoms: Atom[];
  components: Component[];
  layoutRules: Rule[];
  /** Top 10 only: the rank numeral. */
  rank: {
    style: string | null;
    color: string | null;
    gradient: Gradient | null;
    layer: string | null;
  } | null;
}

// ---- rails and page --------------------------------------------------------------------------

export interface TapAction {
  type: 'detail' | 'player' | 'collection' | 'link' | 'none' | string | null;
  target: string | null;
}

export interface RailLayout {
  mode: 'count' | 'designed' | 'exact' | 'tier' | string | null;
  itemsPerView: number | null;
  /** Set only when the rail resizes the card; null = the block's own size. */
  cardWidth: number | null;
  cardHeight: number | null;
  /** Width / height: `count` and `banner` work the height out from it. */
  cardAspectRatio: number | null;
  gap: number | null;
  rowGap: number | null;
  start: number | null;
  end: number | null;
  /** TV: free room to keep around the cards for the focus look. */
  focusInset: Point | null;
  direction: 'horizontal' | 'vertical' | string | null;
  bodyPadding: Sides | null;
}

export interface Rail {
  /** This placement on the page. */
  key: string;
  railId: string | null;
  title: string | null;
  layout: 'hero' | 'carousel' | 'banner' | 'grid' | string | null;
  autoplay: boolean;
  background: Fill | null;
  titleStyle: TextStyle & { textStyle: string | null; hidden: boolean };
  heroLayout: {
    thumbnailStyle: string | null;
    paging: boolean;
    autoAdvanceSec: number | null;
    thumbnailsShown: number | null;
    thumbnailRatio: string | null;
    thumbnailWidth: number | null;
  } | null;
  tap: { card: TapAction; cards: Record<string, TapAction>; elements: Record<string, string> };
  railLayout: RailLayout;
  /** `tap`: where it goes: `collection` (or none sent) the rail's own titles, `link` its `target`, `none` nowhere. */
  seeAll: {
    show: boolean;
    label: string | null;
    tap?: TapAction;
    /** How it is drawn when no header design draws it: a `text` link (label, arrow), a `button`, or just an `arrow`. */
    style?: 'text' | 'button' | 'arrow' | null;
    /** `left` or `right` of the title row. */
    position?: 'left' | 'right' | null;
    /** Adds the rail's title count: "See all (10)". Absent: yes. */
    showCount?: boolean;
    /** Font, size, weight, case and `color`. */
    text?: TextStyle | null;
  };
  grid: { maxRows: number | null } | null;
  blockKey: string | null;
  headerKey: string | null;
  footerKey: string | null;
  source: {
    type: string | null;
    /** 0: nothing to show; hide the rail without calling. */
    count: number | null;
    contentUrl: string | null;
    pageSize: number | null;
  };
}

export interface Page {
  schemaVersion: number;
  id: string | null;
  product: string | null;
  slug: string | null;
  title: string | null;
  version: number | null;
  versionLabel: string | null;
  publishedAt: string | null;
  device: { dt: string | null; deviceClass: string | null; unit: string | null; unitScale: number | null };
  /** Always set; behind everything. */
  background: Fill;
  spacing: { railGap: number | null; railPadding: Sides };
  blocks: Record<string, Block>;
  /** In screen order: the hero first (`layout: hero`), then the rows. */
  rails: Rail[];
  /** Counts rows only (not the hero). More: call again with `start=nextStart`. */
  paging: { start: number | null; rows: number | null; total: number | null; nextStart: number | null };
}
