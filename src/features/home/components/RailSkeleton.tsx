import styled, { css, keyframes } from 'styled-components';
import type { Layout } from '@/lib/api/types';
import { toCssAspectRatio } from '@/lib/aspectRatio';

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

/** Same `count`-driven grid as the real row's Scroller (Rail.tsx) — a
 * skeleton with a different width-deriving rule than the content it stands
 * in for is exactly how the hero's layout-jump bug happened the first time. */
const Row = styled.div<{ $count: number }>`
  display: grid;
  grid-auto-flow: column;
  gap: ${({ theme }) => theme.space(1.5)};
  grid-auto-columns: calc(
    (100% - ${({ theme }) => theme.space(1.5)} * ${(p) => p.$count - 1}) / ${(p) => p.$count}
  );
  padding: 0 ${({ theme }) => theme.space(2)} ${({ theme }) => theme.space(1)};
  overflow: hidden;
`;

const shimmerBackground = css`
  background: linear-gradient(90deg, var(--surface) 25%, var(--surface-raised) 37%, var(--surface) 63%);
  background-size: 400px 100%;
  animation: ${shimmer} 1.4s ease-in-out infinite;
`;

const Block = styled.div<{ $ratio: string }>`
  aspect-ratio: ${(p) => p.$ratio};
  border-radius: ${({ theme }) => theme.radius.md};
  --surface: ${({ theme }) => theme.color.surface};
  --surface-raised: ${({ theme }) => theme.color.surfaceRaised};
  ${shimmerBackground}
`;

const HeroBlock = styled.div`
  margin: 0 ${({ theme }) => theme.space(2)};
  /* Explicit width, not left to fill via margin alone — same transferred-size
     issue HeroBanner's Strip once had. */
  width: calc(100% - ${({ theme }) => theme.space(4)});
  /* Must match HeroBanner's Strip exactly (now a plain 100vh, no
     aspect-ratio — see the note there for why). A mismatch here is exactly
     how the layout-jump bug happened the first time. */
  height: 100vh;
  border-radius: ${({ theme }) => theme.radius.md};
  --surface: ${({ theme }) => theme.color.surface};
  --surface-raised: ${({ theme }) => theme.color.surfaceRaised};
  ${shimmerBackground}
`;

interface RailSkeletonProps {
  layout: Layout;
  aspectRatio: string;
  /** How many cards the real row will show — from `cardsPerRow()`, the same
   * response-driven count Rail.tsx's Scroller/Grid use. Ignored for a
   * banner row, which always shows exactly one full-width slide. */
  count: number;
}

/**
 * Matches the real row's eventual shape, not just a generic placeholder —
 * a banner rail found in testing to be up to 90vh tall (see HeroBanner's
 * Strip) was rendering this skeleton's small 16:9 carousel-row height first,
 * so the page jumped by several hundred pixels the instant the real hero
 * loaded. Whatever size the skeleton claims here has to be paid back the
 * moment real content swaps in.
 */
export function RailSkeleton({ layout, aspectRatio, count }: RailSkeletonProps) {
  const ratio = toCssAspectRatio(aspectRatio);
  if (layout === 'banner') {
    return <HeroBlock aria-hidden />;
  }
  return (
    <Row aria-hidden $count={count}>
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} $ratio={ratio} />
      ))}
    </Row>
  );
}
