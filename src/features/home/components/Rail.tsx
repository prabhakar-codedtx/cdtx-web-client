import { useEffect, type RefObject } from 'react';
import styled, { css } from 'styled-components';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { fetchRailItems, selectRail } from '@/features/home/railsSlice';
import { useInView } from '@/lib/device/useInView';
import { useBreakpoint } from '@/lib/device/useBreakpoint';
import type { DeliveryContainer, DeliveryItem } from '@/lib/api/types';
import { Card } from '@/features/home/components/Card';
import { HeroBanner } from '@/features/home/components/HeroBanner';
import { RailSkeleton } from '@/features/home/components/RailSkeleton';
import { cardsPerRow } from '@/lib/cardsPerRow';

const Section = styled.section<{ $background?: string; $backgroundImage?: string }>`
  margin: ${({ theme }) => theme.space(3)} 0;
  ${(props) =>
    props.$backgroundImage
      ? css`
          background-image: url(${props.$backgroundImage});
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          padding: ${({ theme }) => theme.space(3)} 0;
        `
      : props.$background
        ? css`
            background: ${props.$background};
            padding: ${({ theme }) => theme.space(3)} 0;
          `
        : ''}
`;

const Heading = styled.h2<{ $hasBackground?: boolean }>`
  margin: 0 0 ${({ theme }) => theme.space(1)} ${({ theme }) => theme.space(2)};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme, $hasBackground }) => $hasBackground ? '#ffffff' : theme.color.text};
`;

const ImageHeading = styled.div<{ $hasBackground?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space(1)};
  padding: ${({ theme }) => theme.space(2)};
  color: ${({ theme, $hasBackground }) => $hasBackground ? '#ffffff' : theme.color.text};

  img {
    max-width: 100%;
    height: auto;
  }

  .label {
    font-size: 14px;
    font-weight: 600;
  }
`;

/**
 * A row of exactly `$count` equal-width columns, sized purely from the
 * response's own `page_size` (see cardsPerRow.ts) — no independently-chosen
 * width or height on this end. `grid-auto-columns`/`grid-template-columns`
 * with `calc()` divides the available width by the count and subtracts the
 * gaps, rather than a flex `flex-basis` percentage this client would have
 * had to invent. Height is never set here at all: each Card fills its
 * column's width and derives height from `aspect-ratio` (also server data).
 */
const Scroller = styled.div<{ $count: number }>`
  display: grid;
  grid-auto-flow: column;
  /* start, not the grid default (stretch): a card with a caption below it
     is taller than one with its title overlaid on the image (see
     Card.tsx's title_overlay branch), and letting the grid stretch every
     item to match the tallest one in the row would distort the shorter
     cards' aspect ratio instead of just leaving them their natural height. */
  align-items: start;
  gap: ${({ theme }) => theme.space(1.5)};
  grid-auto-columns: calc(
    (100% - ${({ theme }) => theme.space(1.5)} * ${(p) => p.$count - 1}) / ${(p) => p.$count}
  );
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 0 ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(1)};
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  > * {
    scroll-snap-align: start;
  }
`;

/** Same idea as Scroller but wrapping to further rows instead of scrolling
 * — a `grid` layout container is a tiled page of cards, not a rail. */
const Grid = styled.div<{ $count: number }>`
  display: grid;
  align-items: start;
  gap: ${({ theme }) => theme.space(1.5)};
  padding: 0 ${({ theme }) => theme.space(2)};
  grid-template-columns: repeat(${(p) => p.$count}, minmax(0, 1fr));
`;

interface RailProps {
  container: DeliveryContainer;
  onSelectItem: (item: DeliveryItem) => void;
}

export function Rail({ container, onSelectItem }: RailProps) {
  const dispatch = useAppDispatch();
  const [ref, inView] = useInView<HTMLElement>();
  const breakpoint = useBreakpoint();
  const rail = useAppSelector(selectRail(container.id));
  const source = container.sources[0];

  useEffect(() => {
    if (inView && source && !rail) {
      dispatch(fetchRailItems({ containerId: container.id, contentUrl: source.content_url }));
    }
  }, [inView, source, rail, container.id, dispatch]);

  if (!source) return null;
  if (rail?.status === 'failed' || (rail?.status === 'succeeded' && rail.items.length === 0)) return null;

  const isBanner = container.layout === 'banner';
  const count = cardsPerRow(source, container.size, breakpoint);

  const getBackgroundStyle = () => {
    if (container.background?.background === 'gradient') {
      const styling = (container as any).styling?.ui?.section;
      if (styling?.color) {
        return styling.color;
      }
      const bg = container.background as any;
      if (bg.color && bg.color2) {
        return `linear-gradient(160deg, ${bg.color}, ${bg.color2})`;
      }
    }
    return undefined;
  };

  const getBackgroundImage = () => {
    const styling = (container as any).styling?.ui?.section;
    if (styling?.backdrop) {
      return styling.backdrop;
    }
    return undefined;
  };

  const hasBackground = !!getBackgroundStyle() || !!getBackgroundImage();
  const sectionConfig = (container as any).styling?.ui?.section;
  const sectionType = (container as any).styling?.ui?.sectionType;
  const isImageSection = sectionType === 'image' && sectionConfig?.image;

  return (
    <Section
      ref={ref as RefObject<HTMLElement>}
      aria-label={container.name}
      $background={getBackgroundStyle()}
      $backgroundImage={getBackgroundImage()}
    >
      {!isBanner && (
        isImageSection ? (
          <ImageHeading $hasBackground={hasBackground}>
            <img
              src={sectionConfig.image}
              alt={sectionConfig.label || container.name}
              style={{ width: sectionConfig.imageSizePx || 80, height: 'auto' }}
            />
            {sectionConfig.label && <div className="label">{sectionConfig.label}</div>}
          </ImageHeading>
        ) : (
          <Heading $hasBackground={hasBackground}>{container.name}</Heading>
        )
      )}
      {rail?.status !== 'succeeded' ? (
        <RailSkeleton layout={container.layout} aspectRatio={container.aspect_ratio} count={count} />
      ) : isBanner ? (
        <HeroBanner
          items={rail.items}
          containerAspectRatio={container.aspect_ratio}
          onSelect={onSelectItem}
        />
      ) : container.layout === 'grid' ? (
        <Grid $count={count}>
          {rail.items.map((item) => (
            <Card
              key={item.id}
              item={item}
              containerAspectRatio={container.aspect_ratio}
              onSelect={onSelectItem}
            />
          ))}
        </Grid>
      ) : (
        <Scroller $count={count}>
          {rail.items.map((item) => (
            <Card
              key={item.id}
              item={item}
              containerAspectRatio={container.aspect_ratio}
              onSelect={onSelectItem}
            />
          ))}
        </Scroller>
      )}
    </Section>
  );
}
