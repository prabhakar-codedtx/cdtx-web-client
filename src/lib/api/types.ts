/**
 * Wire types for the delivery API (`/v1/*`), typed from the actual running
 * backend response shapes (`backend/app/schemas/storefront.py`,
 * `services/content.py::_serialize`) — not from the aspirational
 * `docs/delivery-api-contract-confirmed.md`, whose camelCase/embedded-items
 * shape is not what the server sends today. Field names here are snake_case
 * because that is what the backend actually emits; if the backend ever
 * migrates to the confirmed contract, this file moves with it.
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

export type Layout = 'banner' | 'carousel' | 'grid';
export type ContainerSize = 'regular' | 'large' | 'xlarge';
export type ContainerTag = 'regular' | 'vod' | 'playlist';
export type ClickAction = 'detail' | 'player';
export type ContentType =
  'movie' | 'series' | 'season' | 'episode' | 'channel' | 'event' | 'trailer' | 'promotion' | 'card';

export interface DeliveryItemSource {
  source_type: 'manual' | 'query' | 'collection' | 'recommended' | 'time_based';
  priority: number;
  count: number;
  content_url: string;
  page_size: number | null;
  total_pages: number | null;
}

/**
 * A container-wide decoration the server asks every card in the row to
 * carry — never per-item (contrast with `DeliveryItem.title_overlay`,
 * which one card can set and another can leave off). `display` is the
 * string `"true"`/`"false"`, not a boolean — that is what the backend
 * actually emits (`app/schemas/storefront.py`'s JSONB passthrough), and an
 * unconfigured container sends `{}` rather than omitting the field, so
 * `display` may also simply be absent.
 */
export interface LogoOverlay {
  display?: 'true' | 'false';
  logoType?: 'play' | 'network' | 'brand';
  position?: 'top' | 'bottom' | 'center';
  transparency?: number;
}

export interface TagOverlay {
  display?: 'true' | 'false';
  position?: 'topright' | 'topleft' | 'bottomright' | 'bottomleft';
  tagType?: 'premium' | 'free' | 'new';
  transparency?: number;
}

/**
 * Client-side rail presenter selector. The backend only ever emits
 * `"rounded_rail"` today — its `RailDecorator` enum (`app/models/enums.py`)
 * has exactly one member, whitelisted out of the ~20 the reference
 * Quickplay SDK defines (see that enum's own docstring) — so this is a
 * closed set on the wire, not an open string.
 */
export type RailDecorator = 'rounded_rail';

export interface DeliveryContainer {
  id: string;
  name: string;
  layout: Layout;
  size: ContainerSize;
  aspect_ratio: string;
  click_action: ClickAction;
  autoplay: boolean;
  container_tag: ContainerTag;
  rail_decorators: RailDecorator[];
  background: Record<string, unknown>;
  styling: Record<string, unknown>;
  scroll_style: Record<string, unknown>;
  logo_overlay: LogoOverlay;
  tag_overlay: TagOverlay;
  sources: DeliveryItemSource[];
}

export interface DeliveryTab {
  id: string;
  slug: string;
  name: string;
  containers: DeliveryContainer[];
  total_pages: number;
  current_page: number;
}

export interface DeliveryStorefront {
  id: string;
  slug: string;
  name: string;
  version: number;
  tabs: DeliveryTab[];
}

export interface DeliveryImage {
  url: string;
  aspect_ratio: string | null;
}

/**
 * The 3x3 anchor grid the admin console's own position picker uses for an
 * overlaid title (and section headings, CTA buttons, etc. — one shared
 * vocabulary, see `frontend/src/lib/types/merchandising.ts`'s
 * `OverlayGridPosition`). Not the short `tr`/`br`/`tl` codes — those are a
 * separate, unrelated shorthand used only by `badges[].corner`.
 */
export type OverlayGridPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** Burns the title onto the card image at `position` instead of the plain
 * caption below it. Mirrors the admin's `titleOverlay` (same file as
 * OverlayGridPosition) — `insetXPx`/`insetYPx` are the current fields,
 * `paddingPx` a legacy fallback for a card authored before those existed. */
export interface TitleOverlay {
  position: OverlayGridPosition;
  paddingPx?: number;
  insetXPx?: number;
  insetYPx?: number;
}

/** Icons a CTA button may carry — the same short whitelist as the admin's
 * `CtaIcon` (`frontend/src/lib/types/merchandising.ts`): every one of these
 * has to exist in a client's icon set before it can be sent on the wire. */
export type CtaIcon = 'play' | 'plus' | 'bell' | 'heart' | 'download' | 'info';

/** What tapping a CTA does. `link` keeps the destination for 'link'. */
export type CtaAction = 'play' | 'detail' | 'link' | 'mylist' | 'reminder';

/** A button overlaid on a card's art (typically a hero/banner card) —
 * mirrors the admin's `ContainerCta` exactly (same file as `CtaIcon`),
 * since `services/publishing.py::_merge_attached_buttons` writes this
 * straight from that shape into the published snapshot's `cta` list. */
export interface CardCta {
  label: string;
  link: string;
  style?: 'primary' | 'secondary';
  icon?: CtaIcon | null;
  iconSide?: 'left' | 'right';
  fill?: 'solid' | 'outline' | 'plain';
  color?: string;
  textColor?: string;
  radiusPx?: number;
  size?: 'sm' | 'md' | 'lg';
  action?: CtaAction;
  position?: OverlayGridPosition;
  offsetX?: number;
  offsetY?: number;
  insetXPx?: number;
  insetYPx?: number;
  iconOnly?: boolean;
}

/** A free-text card badge/ribbon — mirrors the admin's `CardBadge`. `corner`
 * is the short `tl`/`tr`/`bl`/`br` shorthand, not `OverlayGridPosition`. */
export interface CardBadge {
  text: string;
  corner: 'tl' | 'tr' | 'bl' | 'br';
  color?: 'accent' | 'dark' | 'light' | (string & {});
  widthPct?: number;
  insetXPx?: number;
  insetYPx?: number;
}

/** One catalog title or authored card — the two shapes content.py serializes
 * to the same flat fields, so a rail renders both without knowing which. */
export interface DeliveryItem {
  id: string;
  content_type: ContentType;
  slug: string | null;
  name: string;
  /** Only ever present on a real catalog title (`content.py::_serialize`) —
   * absent on an authored card, which has no per-row language column. */
  language?: string;
  release_year: number | null;
  duration_seconds: number | null;
  genres: string[];
  images: DeliveryImage[];
  entitlements: unknown;
  available_until: string | null;
  // Card-only fields — absent (undefined) on a real catalog title.
  cta?: CardCta[];
  badges?: CardBadge[];
  presentation_kind?: string | null;
  /** Absent/null means "no overlay" — the admin's own documented default is
   * a plain caption below the card, not an overlay at a fallback position. */
  title_overlay?: TitleOverlay | null;
  description_overlay?: Record<string, unknown> | null;
  rank?: number | null;
  progress?: number | null;
  duration_label?: string | null;
  metadata?: string | null;
  foreground?: Record<string, unknown> | null;
  /** A card's own per-item override of the container's `click_action` (e.g.
   * "play this one immediately" on an otherwise detail-page row) —
   * `_card_to_delivery_item` defaults it to `"detail"` server-side, so it is
   * always present on a card but never on a real catalog title. */
  click_action?: ClickAction;
  /** A plain caption line, independent of `metadata`/`description_overlay`
   * — `null` (not just absent) when the editor left it blank, since the
   * backend always sends the key once a card reaches this whitelist. */
  description?: string | null;
  /** Opaque, console-authored font styling for this card's own caption
   * text — `fontSize`/`fontWeight` are the two keys the admin's editor
   * itself scaffolds today (`frontend/src/lib/types/merchandising.ts`), but
   * this is a JSONB passthrough with no fixed schema on the wire (same
   * treatment as `badges`/`title_overlay`), so anything else authored
   * there arrives here too. `{}` — never absent — when unset. */
  text_style?: { fontSize?: string; fontWeight?: string } & Record<string, unknown>;
}

/** Region/locale/device the delivery API scopes every request by. */
export interface DeliveryContext {
  reg: string;
  locale: string;
  dt: string;
}
