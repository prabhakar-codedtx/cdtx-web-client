import type { CSSProperties } from 'react';
import type { Background } from '@/lib/api/types';

/**
 * A rail's `background` or the page's `page_background`, drawn as the JSON says: a colour; a
 * gradient (its ready `css`); or a picture that covers the box, centred, under a black `scrim` of
 * that opacity, on `fallbackColor` while it loads or if it fails. Nothing set: no style.
 */
export function backgroundCss(bg: Background | null | undefined): CSSProperties {
  if (!bg) return {};
  if (bg.kind === 'color') return { backgroundColor: bg.color };
  if (bg.kind === 'gradient') return { backgroundImage: bg.css };
  const url = `url(${JSON.stringify(bg.imageUrl)})`;
  return {
    backgroundColor: bg.fallbackColor,
    backgroundImage: bg.scrim
      ? `linear-gradient(rgba(0,0,0,${bg.scrim}), rgba(0,0,0,${bg.scrim})), ${url}`
      : url,
    backgroundSize: bg.fit === 'cover' ? 'cover' : 'contain',
    backgroundPosition: bg.align ?? 'center',
    backgroundRepeat: 'no-repeat',
  };
}
