/**
 * The delivery API's JSON (`/v1/*`), as the page call sends it. The client draws only from this: no
 * design value, size or text lives in the client. Every length is already in the device's own unit
 * (px on the web), so it is drawn as it is (`docs/prd/card-rendering.md`, `API-LIST.md`).
 *
 * Types are written for what the client reads; the server may add keys at any time, and an
 * unknown key is ignored.
 */
import type { LayoutRule } from '@/lib/layout/types';

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

// ---- tabs -------------------------------------------------------------------------------------

export interface TabSummary {
  slug: string;
  name: string;
  icon: string | null;
  position: number;
  is_default: boolean;
  version: number;
  version_label: string | null;
  published_at: string | null;
  url: string;
}

// ---- titles -----------------------------------------------------------------------------------

export interface TitleImage {
  aspect_ratio: string | null;
  url: string;
}

/** A title (or a person, in a cast rail): what a card's text and image parts bind to. */
export interface TitleItem {
  id: string;
  content_type: string;
  slug: string;
  name: string;
  title: string;
  text_title?: string;
  description?: string | null;
  synopsis?: string | null;
  thumbnail_url: string | null;
  images?: TitleImage[];
  logo_url?: string | null;
  image_title?: string | null;
  preview_video_url?: string | null;
  languages?: string[];
  genres?: string[];
  rating?: string | null;
  release_year?: number | null;
  duration_seconds?: number | null;
  video_quality?: string[];
  audio_quality?: string[];
  episode_label?: string | null;
  entitlements?: { package_code: string | null; sku: string | null }[];
  available_until?: string | null;
  // a person item
  role?: string;
  character?: string | null;
  subtitle?: string | null;
  [field: string]: unknown;
}

// ---- card design -----------------------------------------------------------------------------

export interface Frame {
  cx: number;
  cy: number;
  pivot: { x: number; y: number };
  sizing: 'fixed' | 'min' | 'hug' | 'fill';
  w: number | null;
  h: number | null;
  x: number | null;
  y: number | null;
  /** Only when `w` is null (the box hugs its content): the widest it may be, as a share of the
   * card's width. Its content wraps only past this, wherever the box is placed. */
  maxW?: number;
}

export interface BoxRender {
  background?: { color?: string | null; gradient?: string | null; imageUrl?: string | null };
  border?: { top?: string | null; right?: string | null; bottom?: string | null; left?: string | null };
  borderWidthPx?: number;
}

export interface Subview {
  kind: 'icon' | 'text' | 'slider' | string;
  side?: string;
  bind?: string;
  // icon
  icon?: string;
  renderSize?: number;
  size?: number;
  renderColor?: string;
  iconAsset?: {
    tintable: boolean;
    svg?: string;
    png?: { density: string; url: string }[];
    vectorDrawable?: string;
  };
  iconSvgUrl?: string;
  // text
  renderText?: string;
  renderTypography?: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number;
    letterSpacing?: number;
    lineHeightPct?: number;
    textCase?: string;
  };
  // the layer's lengths, final (design size times the part's scale), when the server sends them
  drawSizePx?: number;
  drawFontSizePx?: number;
  drawLetterSpacingPx?: number;
  drawHeightPx?: number;
  /** A progress bar's least width and its corner radius, final. */
  drawMinWidthPx?: number;
  drawCornerPx?: number;
  // slider
  height?: number;
  renderFillColor?: string;
  renderTrackColor?: string;
  staticValue?: number;
  bindingType?: string;
  bindingValue?: string;
}

export interface ElementProps {
  gap?: number;
  render?: BoxRender;
  justify?: 'start' | 'center' | 'end' | 'between' | string;
  verticalAlign?: 'top' | 'middle' | 'bottom' | string;
  layoutDirection?: 'row' | 'column';
  opacity?: number;
  subviews?: Subview[];
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // text parts (a length is a px string, as the design wrote it)
  fontSize?: string | number;
  fontWeight?: string | number;
  /** The font it is drawn in; absent = the page's default font. */
  fontFamily?: string;
  textColor?: string;
  textAlign?: string;
  textCase?: string;
  letterSpacing?: string | number;
  /** A px string is a length (final in `px.lineHeight`); a bare number is a multiple of the font size. */
  lineHeight?: string | number;
  lineClamp?: number;
  /** Final lengths, already times the part's `scale`. */
  textShadows?: { xPx: number; yPx: number; blurPx: number; color: string }[];
  // a metadata line
  metaFields?: string[];
  metaSeparator?: string;
  metaListSeparator?: string;
  metaGapPx?: number;
  metaFieldModes?: Record<string, 'list' | 'count' | 'first'>;
  metaFieldColors?: Record<string, string>;
  metaFieldDisplays?: Record<string, 'text' | 'badge'>;
  customWidthPx?: number;
  customHeightPx?: number;
  [key: string]: unknown;
}

export interface ImageView {
  source: 'content' | 'url';
  contentField: string | null;
  url: string | null;
  fit: 'cover' | 'contain' | 'fill' | 'width' | 'height';
  alignH: 'left' | 'center' | 'right';
  alignV: 'top' | 'center' | 'bottom';
  aspectRatio: number | null;
  fillWidth: boolean;
  radiusFrac: number;
  roundedCorners: string[];
  opacity: number;
  stroke: { colorRef: string | null; widthPx: number } | null;
}

/** A part's lengths, final, in the device's unit: draw them as they are (times the card's `fit`). */
export interface ElementPx {
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  gap?: number;
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  metaGap?: number;
  /** A placed part's own size: exact (`width`/`height`) or the least it may be (`min*`). */
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  borderWidth?: number;
  corner?: number;
}

export interface CardElement {
  id: string;
  name: string;
  type: string;
  action?: string;
  hidden?: boolean;
  slot?: 'overlay' | 'image' | 'below' | 'flow' | 'card';
  zIndex?: number;
  frame?: Frame;
  scale?: number;
  corner?: { px: number | null; pct: number | null };
  bind?: string;
  text?: string;
  role?: string;
  contentBinding?: string;
  image?: ImageView;
  properties: ElementProps;
  /** Final lengths; absent on a server that does not send them yet. */
  px?: ElementPx;
  relative?: { fontSize?: number; borderRadius?: number };
}

export interface AutoLayout {
  direction: 'horizontal' | 'vertical';
  mainAxis: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
  crossAxis: 'start' | 'center' | 'end' | 'stretch' | string;
  gap: number;
  gapY?: number;
  height: { mode: 'hug' | 'fixed' | 'fill'; px?: number };
  width: { mode: 'hug' | 'fixed' | 'fill'; px?: number };
  padding: { x: number; y: number; top?: number; right?: number; bottom?: number; left?: number };
  wrap: boolean;
  /** Final lengths of the layout (times the card's element scale). */
  px?: {
    gap?: number;
    gapY?: number;
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    width?: number;
    height?: number;
  };
  items: (
    | { type: 'element'; id: string }
    | { type: 'group'; id: string; direction: 'horizontal' | 'vertical'; gap: number; elementIds: string[] }
  )[];
}

export interface CompositeComponent {
  id: string;
  name: string;
  type: string;
  elements: CardElement[];
  autoLayout: AutoLayout;
  layoutRules?: LayoutRule[];
  slot: 'card' | 'beside' | 'below' | string;
  zIndex?: number;
  frame?: Frame;
  beside?: { widthPx: number; gapPx: number; align: string };
  box?: Record<string, unknown>;
  sourceComponentId?: string;
}

/** How a card's own picture fills its box (the same keys as an image part's `image`). */
export interface PictureFit {
  fit?: 'cover' | 'contain' | 'fill' | string;
  alignH?: 'left' | 'center' | 'right' | string;
  alignV?: 'top' | 'center' | 'bottom' | string;
}

export interface Presentation {
  aspectRatio: number;
  widthPx: number;
  heightPx: number;
  cornerRadiiFrac: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  shape: string;
  clipPath: string | null;
  border: { edges: string; color: string | null; widthPx: number; followsShape: boolean } | null;
  shadeGradient: string | null;
  gradient?: { css: string } | null;
  backgroundGradient?: { css: string } | null;
  backgroundImage: ({ source: 'content' | 'fixed'; url: string | null } & PictureFit) | null;
  insetImage: ({
    source: 'content' | 'fixed';
    url: string | null;
    leftPx: number;
    topPx: number;
    widthPx: number;
    heightPx: number;
    clipPath: string | null;
  } & PictureFit) | null;
  contentImageAspect: string;
  /** The paint order of the layers, bottom to top. */
  stack: { layer: string; zIndex: number }[];
  display: 'card' | 'hero';
  fill: { width: string; height: string } | null;
  shadows?: {
    kind: 'inner' | 'drop';
    xPx: number;
    yPx: number;
    blurPx: number;
    spreadPx: number;
    color: string;
    opacity: number;
  }[];
  focus: {
    scale: number;
    border: { widthPx: number; color: string } | null;
    glow: { blurPx: number; color: string; opacity: number } | null;
    durationMs: number;
  } | null;
  contentFit: { designedWidthPx: number; designedHeightPx: number; minScale: number; maxScale: number };
}

export interface CardDesign {
  id: string;
  name: string;
  style?: Record<string, unknown>;
  elements: CardElement[];
  compositeComponents: CompositeComponent[];
  flowLayout?: AutoLayout;
  layoutRules?: LayoutRule[];
  presentation: Presentation;
}

// ---- rails and page --------------------------------------------------------------------------

export interface RailLayout {
  sizing: 'exact' | 'tier' | 'count' | 'designed';
  itemsPerView: number | null;
  cardWidthPx: number | null;
  cardHeightPx: number | null;
  cardAspectRatio: number;
  gapPx: number;
  startPx: number;
  endPx: number;
  rowGapPx?: number;
}

export interface RailSource {
  source_type: string;
  count: number;
  content_url: string;
  page_size: number | null;
}

export interface TitleStyle {
  textStyle?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeightPct: number;
  letterSpacing: number;
  textCase: string;
  color: string;
}

export interface HeroLayout {
  carousel: string;
  paging: boolean;
  autoAdvanceSec: number;
  cardsShown: number;
  cardRatio: string;
  cardWidthPx: number;
}

export interface Tap {
  card?: { type: 'detail' | 'player' | 'collection' | 'none' | string };
  hero?: boolean;
  elements?: Record<string, unknown>;
}

/** What is drawn behind a rail (`background`) or the page (`page_background`), resolved. */
export type Background =
  | { kind: 'color'; color: string }
  | {
      kind: 'gradient';
      angle: number;
      stops: { color: string; opacity: number; at: number }[];
      css: string;
    }
  | {
      kind: 'image';
      imageUrl: string;
      fit: 'cover';
      align: 'center';
      scrim?: number;
      fallbackColor?: string;
    };

export interface PageRail {
  key: string;
  rail_id: string;
  name: string;
  layout: 'carousel' | 'banner' | 'grid';
  autoplay: boolean;
  styling: { seeAll?: { show?: boolean }; grid?: { maximumAllowedRows?: number } } & Record<string, unknown>;
  card_component: CardDesign | null;
  rail_layout: RailLayout;
  sources: RailSource[];
  title_style: TitleStyle;
  hero_layout: HeroLayout | null;
  tap: Tap;
  header: CardDesign | null;
  footer: CardDesign | null;
  /** Behind the whole rail; absent or null: nothing, the page shows through. */
  background?: Background | null;
}

export interface DeliveryPage {
  id: string;
  product: string;
  slug: string;
  name: string;
  version: number;
  version_label: string | null;
  published_at: string | null;
  device: { dt: string; class: string; unit: string; unitScale: number };
  tokens: Record<string, unknown>;
  typography: {
    fonts: { key: string; family: string; source: string; stack: string; cssUrl: string | null }[];
    default: string;
  };
  background: string | null;
  /** The page's own background, drawn over `background`; absent or null: none. */
  page_background?: Background | null;
  spacing: {
    railGapPx: number;
    railPaddingPx: number;
    railPaddingTopPx?: number;
    railPaddingRightPx?: number;
    railPaddingBottomPx?: number;
    railPaddingLeftPx?: number;
  };
  hero: PageRail | null;
  rails: PageRail[];
  paging: { start: number; rows: number | null; total: number; next_start: number | null };
}
