import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { DeliveryItem } from '@/lib/api/types';
import { Card } from '@/features/home/components/Card';

const AUTO_ADVANCE_MS = 6000;

const Wrap = styled.div`
  padding: 0 ${({ theme }) => theme.space(2)};
`;

const Strip = styled.div`
  display: flex;
  /* Explicit width *and* height, not aspect-ratio + an implicit width —
     that combination is exactly what caused a real bug found in testing:
     the browser derives a transferred max-width from the capped height and
     shrinks the box (896px on a 1265px row) instead of just cropping the
     image. Setting both dimensions outright leaves aspect-ratio nothing to
     compute, so only the image inside gets cropped (object-fit: cover on
     Card's Art), never this row itself. */
  width: 100%;
  /* Full viewport height, on purpose — the hero is meant to run edge to
     edge under TopNav (now position: fixed, see that file), not stop
     short and leave a gap the fixed bar would otherwise show through. The
     tradeoff this used to guard against (a 100vh hero hiding that there
     are rails below it) is still real on a very tall/narrow viewport, but
     it's now the nav floating over the hero itself — brand + tabs visible
     at the very top — that has to double as that "there's more below" cue,
     since 90vh is no longer available to spend on it. */
  height: 100vh;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  > * {
    flex: 0 0 100%;
    scroll-snap-align: start;
  }
`;

const Dots = styled.div`
  display: flex;
  justify-content: center;
  gap: ${({ theme }) => theme.space(0.75)};
  margin-top: ${({ theme }) => theme.space(1)};
`;

const Dot = styled.button<{ $active: boolean }>`
  width: 8px;
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: ${(p) => (p.$active ? p.theme.color.accent : p.theme.color.border)};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.accent};
    outline-offset: 2px;
  }
`;

interface HeroBannerProps {
  items: DeliveryItem[];
  containerAspectRatio: string;
  onSelect: (item: DeliveryItem) => void;
}

/**
 * A hero rail found in testing to hold several items (a container's
 * `source.count`, not a fixed 1 — one seeded row carries 5), not the single
 * static banner this originally assumed. Rotates through all of them,
 * Netflix-style: auto-advances on a timer, pauses while the user is
 * interacting, and always resumes from wherever they left it rather than
 * snapping back to slide 1.
 */
export function HeroBanner({ items, containerAspectRatio, onSelect }: HeroBannerProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % items.length), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    // `scrollIntoView` was tried here first and caused a real bug: it walks
    // every scrollable ancestor to bring the target fully into view, and if
    // this hero wasn't fully in the viewport when the 6s timer fired, that
    // included the *page* — so the whole screen jumped vertically every
    // auto-advance. Scrolling the strip's own `scrollLeft` directly touches
    // only this element, never the page.
    strip.scrollTo({ left: index * strip.clientWidth, behavior: 'smooth' });
  }, [index]);

  // Scrolling manually (touch swipe, trackpad) should stop fighting the
  // auto-advance timer and adopt whatever slide the user landed on.
  const handleScroll = () => {
    const strip = stripRef.current;
    if (!strip) return;
    const nearest = Math.round(strip.scrollLeft / strip.clientWidth);
    setIndex((current) => (nearest !== current ? nearest : current));
  };

  return (
    <Wrap onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Strip ref={stripRef} onScroll={handleScroll}>
        {items.map((item) => (
          <Card
            key={item.id}
            item={item}
            containerAspectRatio={containerAspectRatio}
            onSelect={onSelect}
            fill
          />
        ))}
      </Strip>
      {items.length > 1 && (
        <Dots role="tablist" aria-label="Featured items">
          {items.map((item, i) => (
            <Dot
              key={item.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1} of ${items.length}`}
              $active={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </Dots>
      )}
    </Wrap>
  );
}
