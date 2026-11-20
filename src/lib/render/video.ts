import type { CSSProperties } from 'react';
import type { Atom, Block, CardVideo, VideoPlayback, WhilePlaying } from '@/lib/api/types';

/**
 * The card's Video atom (a Video component's picture that plays the title's video), and the id of what is
 * placed on the card to hold it: the component, or the atom itself. Null when the card has none on this
 * device (a phone set to show just the picture gets no `video` on the atom).
 */
export function videoAtomOf(block: Block | null | undefined): { atom: Atom; holder: string } | null {
  if (!block) return null;
  for (const atom of block.atoms) if (atom.video) return { atom, holder: atom.id };
  for (const comp of block.components) {
    if (comp.slot !== 'card') continue;
    const atom = comp.atoms.find((a) => a.video);
    if (atom) return { atom, holder: comp.id };
  }
  return null;
}

/** A Video atom's playback as a video layer (the whole of its frame), for the player that draws it. */
export function layerOf(playback: VideoPlayback): CardVideo {
  return {
    source: 'preview',
    area: 'card',
    left: null,
    top: null,
    width: null,
    height: null,
    shapePolygon: [],
    zIndex: 0,
    ...playback,
  };
}

/** CSS that fades a box's edges into what is behind it (`edgeFade`): the video and its poster melt into
 * the card's picture instead of sitting on it as a hard box. Empty when nothing fades. */
export function edgeFadeCss(fade: VideoPlayback['edgeFade']): CSSProperties {
  if (!fade) return {};
  const to = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' } as const;
  const sides = (['left', 'right', 'top', 'bottom'] as const).filter((s) => fade[s] > 0);
  if (!sides.length) return {};
  const image = sides
    .map((s) => `linear-gradient(to ${to[s]}, transparent 0%, #000 ${Math.min(50, fade[s] * 100)}%)`)
    .join(', ');
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  };
}

/** CSS for a placed atom or component while the card's video plays (`whilePlaying`): faded out, hidden or
 * shrunk (to `scale` of its size, from its top-left corner), changing over `ms` - both the CMS's ("While
 * playing" in the Player); as it was once the video stops. Empty for one that stays. */
export function whilePlayingCss(
  mode: WhilePlaying | null | undefined,
  playing: boolean,
  look: { scale?: number; ms?: number } = {},
): CSSProperties {
  if (mode !== 'fade' && mode !== 'hide' && mode !== 'shrink') return {};
  const ease = `${Math.max(0, look.ms ?? 400)}ms ease`;
  if (mode === 'hide') return { visibility: playing ? 'hidden' : 'visible' };
  if (mode === 'fade') {
    return { opacity: playing ? 0 : 1, transition: `opacity ${ease}`, pointerEvents: playing ? 'none' : undefined };
  }
  return {
    transform: playing ? `scale(${look.scale ?? 0.75})` : 'none',
    transformOrigin: 'top left',
    transition: `transform ${ease}`,
  };
}
