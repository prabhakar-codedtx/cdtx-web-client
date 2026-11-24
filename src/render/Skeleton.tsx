import type { CSSProperties } from 'react';
import styled, { keyframes } from 'styled-components';
import { NAV_HEIGHT } from '@/screens/navMetrics';

/**
 * What the app draws while a screen is on its way: grey shapes where the picture, the title and the
 * rows will be, with a light sweeping across, so a viewer sees the screen taking shape instead of a
 * bare "Loading…". Nothing here knows the screen's design yet (it has not arrived): the shapes are
 * a typical storefront, sized for the device. The shapes take the text colour, so they show on a dark
 * page and a light one. Still (no sweep) where the device asks for less motion.
 */

const sweep = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
`;

const Bone = styled.div`
  position: relative;
  overflow: hidden;
  flex: none;
  background: rgba(128, 128, 128, 0.18);
  background: color-mix(in srgb, currentColor 10%, transparent);
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.09), transparent);
    animation: ${sweep} 1.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
      opacity: 0;
    }
  }
`;

/** One grey shape: a box of `w` × `h` (numbers are px), corners `r`. */
function Shape({
  w,
  h,
  r = 8,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  style?: CSSProperties;
}) {
  return <Bone aria-hidden style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** What the device draws: a phone's narrow cards, a TV's big ones, a laptop's in between. */
function sizes(dt: string) {
  const phone = dt.startsWith('mobile');
  const tv = dt === 'androidtv' || dt.endsWith('tv');
  return {
    phone,
    gutter: phone ? 16 : tv ? 48 : 20,
    card: phone ? 112 : tv ? 220 : 168,
    wide: phone ? 220 : tv ? 420 : 300,
    gap: phone ? 10 : 12,
  };
}

/** A row of cards: the rail's title, then the cards (as many as the screen holds; the rest is clipped). */
function RailSkeleton({ dt, wide = false }: { dt: string; wide?: boolean }) {
  const z = sizes(dt);
  const w = wide ? z.wide : z.card;
  const ratio = wide ? 16 / 9 : 2 / 3;
  return (
    <div style={{ padding: `0 ${z.gutter}px` }}>
      <Shape w={z.phone ? 140 : 190} h={z.phone ? 18 : 22} r={6} style={{ margin: '0 0 14px' }} />
      <div style={{ display: 'flex', gap: z.gap, overflow: 'hidden' }}>
        {Array.from({ length: 12 }, (_, i) => (
          <Shape key={i} w={w} h={Math.round(w / ratio)} r={10} />
        ))}
      </div>
    </div>
  );
}

const Frame = styled.div`
  box-sizing: border-box;
  color: #ffffff;
  background: #000000;
`;

/** The tab bar before it exists: the logo, a few tabs, the viewer's icon. */
function BarSkeleton({ dt }: { dt: string }) {
  const z = sizes(dt);
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        height: NAV_HEIGHT,
        padding: `0 ${z.gutter}px`,
      }}
    >
      <Shape w={34} h={34} r={8} />
      {!z.phone && [64, 72, 60, 68].map((w, i) => <Shape key={i} w={w} h={14} r={5} />)}
      <span style={{ flex: 1 }} />
      <Shape w={36} h={36} r="50%" />
    </div>
  );
}

/**
 * A storefront page: the hero, then rows of cards. `bar` draws the tab bar too (before the app has
 * started, when no bar exists yet); `inDialog` is for the inside of the details dialog, which has
 * its own frame and height.
 */
export function PageSkeleton({
  dt,
  bar = false,
  inDialog = false,
}: {
  dt: string;
  bar?: boolean;
  inDialog?: boolean;
}) {
  const z = sizes(dt);
  return (
    <Frame
      role="status"
      aria-busy="true"
      aria-label="Loading"
      style={{ minHeight: inDialog ? undefined : '100vh', paddingTop: bar ? 0 : inDialog ? 0 : NAV_HEIGHT }}
    >
      {bar && <BarSkeleton dt={dt} />}
      {/* The hero: a wide picture, its title and button on the lower left, its dots beneath. */}
      <div style={{ padding: z.phone ? 0 : `0 ${z.gutter * 4}px`, position: 'relative' }}>
        <Shape w="100%" h={z.phone ? 'min(62vh, 420px)' : 'clamp(260px, 52vh, 520px)'} r={z.phone ? 0 : 24} />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: z.phone ? 20 : z.gutter * 4 + 32,
            bottom: z.phone ? 28 : 40,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <Shape w={z.phone ? 180 : 260} h={z.phone ? 22 : 30} r={6} />
          <Shape w={z.phone ? 140 : 200} h={12} r={5} />
          <Shape w={120} h={z.phone ? 36 : 40} r={20} style={{ marginTop: 6 }} />
        </div>
      </div>
      <div aria-hidden style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '14px 0 22px' }}>
        {Array.from({ length: 7 }, (_, i) => (
          <Shape key={i} w={i === 0 ? 20 : 7} h={7} r={4} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: z.phone ? 22 : 30, paddingBottom: 48 }}>
        <RailSkeleton dt={dt} />
        <RailSkeleton dt={dt} wide />
        <RailSkeleton dt={dt} />
      </div>
    </Frame>
  );
}

/**
 * A title's detail screen: the picture and the words about the title (name, a line of facts, a few
 * lines of story, the Play button), then rows. On a phone the picture sits over the words.
 */
export function DetailSkeleton({ dt, inDialog = false }: { dt: string; inDialog?: boolean }) {
  const z = sizes(dt);
  return (
    <Frame
      role="status"
      aria-busy="true"
      aria-label="Loading"
      style={{ minHeight: inDialog ? undefined : '100vh', paddingTop: inDialog ? 0 : NAV_HEIGHT }}
    >
      <div
        aria-hidden
        style={{
          display: 'flex',
          flexDirection: z.phone ? 'column' : 'row',
          gap: z.phone ? 16 : 32,
          padding: `${z.phone ? 0 : 24}px ${z.phone ? 0 : z.gutter * 2}px 0`,
        }}
      >
        <Shape
          w={z.phone ? '100%' : '58%'}
          h={z.phone ? 'min(56vw, 260px)' : 'clamp(240px, 42vh, 420px)'}
          r={z.phone ? 0 : 16}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: z.phone ? `0 ${z.gutter}px` : 0,
          }}
        >
          <Shape w="70%" h={z.phone ? 26 : 34} r={6} />
          <Shape w="45%" h={14} r={5} />
          <Shape w="100%" h={12} r={5} style={{ marginTop: 8 }} />
          <Shape w="96%" h={12} r={5} />
          <Shape w="80%" h={12} r={5} />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Shape w={140} h={44} r={22} />
            <Shape w={44} h={44} r="50%" />
            <Shape w={44} h={44} r="50%" />
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, padding: '32px 0 48px' }}>
        <RailSkeleton dt={dt} />
        <RailSkeleton dt={dt} wide />
      </div>
    </Frame>
  );
}

/** A "See all" grid: cards in columns. Drawn inside the screen's own frame, so it takes its colour. */
export function GridSkeleton({ dt }: { dt: string }) {
  const z = sizes(dt);
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <Shape w={z.phone ? 150 : 220} h={z.phone ? 22 : 28} r={6} style={{ marginBottom: 18 }} />
      <div
        aria-hidden
        style={{
          display: 'grid',
          gap: z.gap,
          gridTemplateColumns: `repeat(auto-fill, minmax(${z.card}px, 1fr))`,
        }}
      >
        {Array.from({ length: 18 }, (_, i) => (
          <Shape key={i} w="100%" h="auto" r={10} style={{ aspectRatio: '2 / 3' }} />
        ))}
      </div>
    </div>
  );
}
