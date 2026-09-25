import styled from 'styled-components';
import { Bell, Download, Film, Heart, Info, Play, Plus, Radio, Sparkles, Tv } from 'lucide-react';
import type { CardBadge, CardCta, CtaIcon, DeliveryItem, TitleOverlay } from '@/lib/api/types';
import { pickImage, toCssAspectRatio } from '@/lib/aspectRatio';
import { anchorAlignCss, anchorInsetCss } from '@/lib/overlayPosition';
import { cardTextStyleCss } from '@/lib/textStyle';

const TYPE_ICON: Partial<Record<DeliveryItem['content_type'], typeof Film>> = {
  movie: Film,
  series: Tv,
  season: Tv,
  episode: Tv,
  channel: Radio,
  event: Radio,
  promotion: Sparkles,
};

const CTA_ICON: Record<CtaIcon, typeof Play> = {
  play: Play,
  plus: Plus,
  bell: Bell,
  heart: Heart,
  download: Download,
  info: Info,
};

const Figure = styled.figure`
  /* Resets the UA default (browsers give <figure> a 40px side margin). */
  margin: 0;
  min-width: 0;
`;

/**
 * `div[role=button]`, not a real `<button>` — a card with CTA buttons
 * overlaid on it (see `CtaButtonEl` below) needs real `<button>` elements
 * nested inside it, and a `<button>` cannot legally contain another
 * `<button>` (the browser silently breaks the nesting). `tabIndex`/
 * `onKeyDown` restore the keyboard/TV-remote activation a real `<button>`
 * gets for free.
 */
const Frame = styled.div<{ $ratio: string; $fill?: boolean }>`
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  /* Every rail/grid track already gives this card a definite width (from
     cardsPerRow() — see Rail.tsx), so aspect-ratio only ever needs to
     derive height, never fight over width. A hero slide (fill prop) is the
     one exception: HeroBanner's wrapper already owns both dimensions
     (capped height, full width), so this just fills it and lets
     object-fit: cover crop the image, rather than applying its own
     aspect-ratio on top and re-triggering the transferred-size shrink
     found earlier. */
  ${(p) => (p.$fill ? 'height: 100%;' : `aspect-ratio: ${p.$ratio};`)}
  border: none;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  background: ${({ theme }) => theme.color.surface};
  cursor: pointer;
  padding: 0;

  /* Focus-visible, not :hover — a TV remote and keyboard tab both need a
     ring; a mouse hover alone would leave D-pad navigation invisible. */
  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.color.accent};
    outline-offset: 2px;
  }

  &:hover img {
    transform: scale(1.04);
  }
`;

const Art = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 160ms ease-out;
`;

const Placeholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.color.textMuted};
`;

const Rank = styled.span`
  position: absolute;
  left: 8px;
  bottom: 0;
  font-size: clamp(28px, 6vw, 64px);
  font-weight: 800;
  line-height: 1;
  color: ${({ theme }) => theme.color.text};
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
`;

/**
 * A full-cover, non-interactive flex slot for one 9-anchor overlay (a
 * title, or one CTA button) — `anchorAlignCss` places its single child at
 * the right corner/edge/center, `anchorInsetCss` pads it in from there,
 * capped so a desktop-authored inset can never overrun a narrower card.
 * `pointer-events: none` on the slot (re-enabled on the interactive child
 * itself, e.g. `CtaButtonEl`) lets a click anywhere in the slot's unused
 * space still reach `Frame`'s own click handler underneath.
 */
const AnchorSlot = styled.span<{
  $overlay: { position: TitleOverlay['position']; insetXPx?: number; insetYPx?: number; paddingPx?: number };
  $basePx: number;
  $capPercent: number;
}>`
  position: absolute;
  inset: 0;
  display: flex;
  pointer-events: none;
  ${(p) => anchorAlignCss(p.$overlay.position)}
  ${(p) => anchorInsetCss(p.$overlay, p.$basePx, p.$capPercent)}
`;

/** The 3 named looks an editor picks by hand (see the admin's
 * `badgeColorStyle`) — anything else is a raw CSS color a badge baked from
 * an attached library tag can carry verbatim. Default (unset) is the
 * accent color, matching the admin's own canonical default exactly. */
function badgeBackground(color: CardBadge['color']): string {
  switch (color) {
    case 'dark':
      return 'rgba(0, 0, 0, 0.75)';
    case 'light':
      return '#ffffff';
    case 'accent':
    case undefined:
      return 'var(--accent)';
    default:
      return color;
  }
}

function badgeTextColor(color: CardBadge['color']): string {
  return color === 'light' ? 'var(--card-fg)' : '#fff';
}

/**
 * One corner's badges, grouped into a single flex row — two badges
 * authored at the same corner (e.g. "4K" and "TAMIL" both `tl`) used to
 * render at the exact same fixed point, on top of each other. Mirrors the
 * admin console's own `CardBadgeCluster` fix for the identical bug: badges
 * sharing a corner sit side by side, not stacked. Per-badge `insetXPx`/
 * `insetYPx` are deliberately not consulted here — same as the admin's
 * canonical render — only the group's one fixed corner offset is used, so
 * this can never regress into the stacking bug regardless of what an
 * editor (or an attached tag merged at publish time) set on an individual
 * badge.
 */
const BadgeCorner = styled.span<{ $corner: CardBadge['corner'] }>`
  position: absolute;
  ${(p) => (p.$corner.includes('t') ? 'top: 6px;' : 'bottom: 6px;')}
  ${(p) => (p.$corner.includes('r') ? 'right: 6px;' : 'left: 6px;')}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
`;

const Badge = styled.span<{ $badge: CardBadge }>`
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${(p) => badgeBackground(p.$badge.color)};
  color: ${(p) => badgeTextColor(p.$badge.color)};
  ${(p) => (p.$badge.widthPct ? `width: ${p.$badge.widthPct}%; text-align: center;` : '')}
  --accent: ${({ theme }) => theme.color.accent};
  --card-fg: ${({ theme }) => theme.color.background};
`;

/** Title + (on a hero) description, stacked as one text block at the
 * overlay's anchor point — a hero's description sits right under its
 * title, not independently positioned, same grouping the admin's own hero
 * info box uses. */
const TitleBlock = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: calc(100% - 16px);
`;

/** Title burned onto the image at the admin-authored anchor point — only
 * rendered when `item.title_overlay` is actually set. A small text-shadow
 * stands in for a scrim since the label no longer spans the full card
 * width at a fixed edge; it needs to stay legible wherever the 3x3 grid
 * places it. `fontSize`/`fontWeight` normally come from `text_style` via
 * `cardTextStyleCss`'s inline style — this default only applies when a
 * card's `text_style` carries no `fontSize` at all (an editor never set
 * one). It still has to match the hero-vs-card scale, not one fixed value:
 * a card authored before `text_style` existed and landing in a hero rail
 * must not fall back to the same tiny size a rail-card caption uses. */
const OverlayTitle = styled.span<{ $fill?: boolean }>`
  font-size: ${(p) => (p.$fill ? 'clamp(22px, 3vw, 52px)' : '13px')};
  font-weight: 600;
  color: #fff;
  text-shadow:
    0 1px 3px rgba(0, 0, 0, 0.85),
    0 0 12px rgba(0, 0, 0, 0.5);
`;

/** A hero card's own plain caption line — `item.description`, independent
 * of `description_overlay` (a separately *positioned* description, not
 * every hero's). Only ever rendered alongside a title overlay on a hero
 * (see `description = fill ? item.description : null`), so its default
 * only ever needs the hero scale, unlike OverlayTitle's dual default. */
const Description = styled.span`
  font-size: clamp(13px, 1.2vw, 18px);
  font-weight: 400;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  max-width: 32ch;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

/** The admin's documented default when a card has no title_overlay: "keeps
 * today's caption-below behaviour" — plain text under the image, not an
 * overlay. Lives outside Frame, in Figure's normal document flow. */
const Caption = styled.figcaption`
  padding: ${({ theme }) => theme.space(0.75)} 2px 0;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.color.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProgressTrack = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.25);
`;

const ProgressFill = styled.div<{ $pct: number }>`
  height: 100%;
  width: ${(p) => p.$pct * 100}%;
  background: ${({ theme }) => theme.color.accent};
`;

// Real px, matching the admin's own `CTA_SIZE_CLASS` exactly (Tailwind's
// px-2.5/py-1.5/text-11px etc., converted to px) — the client and the
// editor's own preview should render an authored button at the same size.
const CTA_SIZE = {
  sm: { padX: 10, padY: 6, font: 11 },
  md: { padX: 14, padY: 8, font: 13 },
  lg: { padX: 20, padY: 10, font: 15 },
} as const;

const CTA_ICON_DIAMETER = { sm: 32, md: 44, lg: 60 } as const;

/** Rough perceived lightness, for picking readable label text on a solid
 * fill — same formula as the admin's own `isLight`. */
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

const CtaButtonEl = styled.button<{
  $size: NonNullable<CardCta['size']>;
  $radius: number;
  $iconOnly: boolean;
  $background: string;
  $border: string;
  $color: string;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  pointer-events: auto;
  border-radius: ${(p) => Math.min(p.$radius, 999)}px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: ${(p) => CTA_SIZE[p.$size].padY}px
    ${(p) => (p.$iconOnly ? CTA_SIZE[p.$size].padY : CTA_SIZE[p.$size].padX)}px;
  font-size: ${(p) => CTA_SIZE[p.$size].font}px;
  border: ${(p) => p.$border};
  background: ${(p) => p.$background};
  color: ${(p) => p.$color};
  transition:
    filter 120ms ease-out,
    transform 120ms ease-out;

  ${(p) =>
    p.$iconOnly
      ? `width: ${CTA_ICON_DIAMETER[p.$size]}px; height: ${CTA_ICON_DIAMETER[p.$size]}px; padding: 0; border-radius: 999px;`
      : ''}

  &:hover {
    filter: brightness(1.12);
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.accent};
    outline-offset: 2px;
  }
`;

/**
 * Every CTA button in one flex row, not each independently anchored by its
 * own `position`/`insetXPx`/`insetYPx` — found live, against the real
 * seeded "Avengers" hero, that every button in an authored row shares one
 * `position` ("bottom-left") and is spread out purely by increasing
 * `insetXPx` per button (40, 370, 340) — i.e. the data models one row laid
 * out left-to-right, not three independently placed buttons. Positioning
 * each one absolutely by its own inset (this component's first
 * implementation) reproduced exactly the bug already confirmed live in the
 * admin console for the same data (`storefront-container-row.tsx`'s
 * `BANNER_INSET_CAP_PERCENT` docstring: "Watch Now"/"Trailer"/"Add To
 * Playlist" landing on top of each other) — capping the inset shrank the
 * overlap but never fixed the actual mismatch between "3 authored
 * `insetXPx` offsets" and "3 independent anchor points". A flex row with a
 * gap needs no inset math at all: it cannot overlap by construction.
 */
const CtaRow = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
`;

interface CtaButtonProps {
  cta: CardCta;
  onActivate: (cta: CardCta) => void;
}

/**
 * Fill/color resolution mirrors the admin's own `CtaButton` exactly
 * (`storefront-container-row.tsx`) — `fill` defaults to `outline` only for
 * the legacy `style: 'secondary'` marker, otherwise `solid`; a solid fill
 * with no explicit `textColor` picks black or white by the background's own
 * perceived lightness so a white/pale authored color never renders
 * invisible white-on-white text.
 */
function CtaButton({ cta, onActivate }: CtaButtonProps) {
  const Icon = cta.icon ? CTA_ICON[cta.icon] : undefined;
  const fill = cta.fill ?? (cta.style === 'secondary' ? 'outline' : 'solid');
  const color = cta.color ?? '#ffffff';
  const size = cta.size ?? 'md';
  const iconOnly = cta.iconOnly ?? false;
  const iconSize = iconOnly ? Math.round(CTA_ICON_DIAMETER[size] * 0.4) : 13;

  let background = 'transparent';
  let border = 'none';
  let textColor = cta.textColor ?? color;
  if (fill === 'solid') {
    background = color;
    textColor = cta.textColor ?? (isLight(color) ? '#191d33' : '#ffffff');
  } else if (fill === 'outline') {
    border = `1.5px solid ${color}`;
    background = 'rgba(255, 255, 255, 0.12)';
  }

  return (
    <CtaButtonEl
      type="button"
      $size={size}
      $radius={cta.radiusPx ?? 999}
      $iconOnly={iconOnly}
      $background={background}
      $border={border}
      $color={textColor}
      aria-label={iconOnly ? cta.label : undefined}
      onClick={(e) => {
        // Stops the click from bubbling to Frame's own onClick — a CTA tap
        // ("Watch Now") and a bare card tap ("more info") are two different
        // actions and must never both fire from one click.
        e.stopPropagation();
        onActivate(cta);
      }}
    >
      {Icon && <Icon size={iconSize} />}
      {!iconOnly && cta.label}
    </CtaButtonEl>
  );
}

interface CardProps {
  item: DeliveryItem;
  containerAspectRatio: string;
  onSelect: (item: DeliveryItem) => void;
  /** True inside a banner/hero rail, whose wrapper already owns the
   * aspect-ratio and height cap — see HeroBanner.tsx. Also gates whether
   * `item.cta` renders: a rail card is rarely wider than ~200px, nowhere
   * near enough room for even one button, let alone three anchored at
   * independent corners — the admin's own docs describe `cta` as "e.g. a
   * banner's Watch Now", not a rail-card feature. */
  fill?: boolean;
  /** Fired when a CTA button (not the card itself) is activated. Optional:
   * a caller that only cares about "card selected" (every screen today) can
   * omit it and CTA taps just fall through to `onSelect`. */
  onCtaSelect?: (item: DeliveryItem, cta: CardCta) => void;
}

// A hero slide always shows its title on the image — a caption below a
// fixed-height (see HeroBanner's 90vh cap) slide would overflow the box,
// and no real hero banner shows a caption underneath anyway. Every other
// card follows the admin's own rule exactly: overlay only if authored,
// caption below otherwise.
const HERO_FALLBACK_OVERLAY: TitleOverlay = { position: 'bottom-left' };

// A hero card's own inset budget is tighter than a plain overlay's: the
// admin's confirmed-live fix for this exact class of bug
// (`BANNER_INSET_CAP_PERCENT`) caps a full-bleed 16:9 banner at 10% of its
// own width, vs. 18% for every other card shape. See `anchorInsetCss`'s
// docstring for why the cap has to be width-relative on both axes.
const INSET_BASE_PX = 8;
const INSET_CAP_PERCENT = { banner: 10, card: 18 } as const;

export function Card({ item, containerAspectRatio, onSelect, fill, onCtaSelect }: CardProps) {
  const art = pickImage(item.images, containerAspectRatio);
  const Icon = TYPE_ICON[item.content_type];
  const title = item.name || 'Untitled';
  const overlay = item.title_overlay ?? (fill ? HERO_FALLBACK_OVERLAY : null);
  const ctas = fill ? item.cta : undefined;
  const capPercent = fill ? INSET_CAP_PERCENT.banner : INSET_CAP_PERCENT.card;
  // Dynamic — resolved from whatever `text_style` the editor actually set
  // (see `cardTextStyleCss`'s docstring), not a hardcoded size/weight. One
  // authored `text_style`, but three different *sizes* depending which
  // element and context it lands on: a hero's title/description need a
  // fluid, much larger scale than a plain caption under a small rail card
  // — see `HERO_TITLE_FONT_SIZE`/`HERO_DESCRIPTION_FONT_SIZE`.
  const titleTextStyleCss = cardTextStyleCss(item.text_style, fill ? 'heroTitle' : 'caption');
  const descriptionTextStyleCss = cardTextStyleCss(item.text_style, 'heroDescription');
  const captionTextStyleCss = cardTextStyleCss(item.text_style, 'caption');
  const description = fill ? item.description : null;
  const badgesByCorner = new Map<CardBadge['corner'], CardBadge[]>();
  for (const badge of item.badges ?? []) {
    badgesByCorner.set(badge.corner, [...(badgesByCorner.get(badge.corner) ?? []), badge]);
  }

  const activate = () => onSelect(item);

  return (
    <Figure>
      <Frame
        $ratio={toCssAspectRatio(containerAspectRatio)}
        $fill={fill}
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
        aria-label={title}
      >
        {art ? (
          <Art src={art} alt={title} loading="lazy" />
        ) : (
          <Placeholder>{Icon ? <Icon size={28} /> : null}</Placeholder>
        )}
        {typeof item.rank === 'number' && <Rank>{item.rank}</Rank>}
        {[...badgesByCorner.entries()].map(([corner, badges]) => (
          <BadgeCorner key={corner} $corner={corner}>
            {badges.map((badge, i) => (
              <Badge key={i} $badge={badge}>
                {badge.text}
              </Badge>
            ))}
          </BadgeCorner>
        ))}
        {overlay && (
          <AnchorSlot $overlay={overlay} $basePx={INSET_BASE_PX} $capPercent={capPercent}>
            <TitleBlock>
              <OverlayTitle $fill={fill} style={titleTextStyleCss}>
                {title}
              </OverlayTitle>
              {description && <Description style={descriptionTextStyleCss}>{description}</Description>}
            </TitleBlock>
          </AnchorSlot>
        )}
        {ctas && ctas.length > 0 && (
          <AnchorSlot
            $overlay={{
              position: ctas[0]!.position ?? 'bottom-left',
              insetXPx: ctas[0]!.insetXPx,
              insetYPx: ctas[0]!.insetYPx,
            }}
            $basePx={INSET_BASE_PX}
            $capPercent={capPercent}
          >
            <CtaRow>
              {ctas.map((cta, i) => (
                <CtaButton
                  key={i}
                  cta={cta}
                  onActivate={(c) => (onCtaSelect ? onCtaSelect(item, c) : onSelect(item))}
                />
              ))}
            </CtaRow>
          </AnchorSlot>
        )}
        {typeof item.progress === 'number' && (
          <ProgressTrack>
            <ProgressFill $pct={item.progress} />
          </ProgressTrack>
        )}
      </Frame>
      {!overlay && <Caption style={captionTextStyleCss}>{title}</Caption>}
    </Figure>
  );
}
