import { useCallback, useEffect, useRef, useState } from 'react';
import { adopt, done, playerCarryKey, type Carried } from '@/player/carry';
import type { PlayerHandoff } from '@/player/handoff';

/** How long the carried video fades out once the player's own stream has taken over (ms). */
const FADE_MS = 400;

/**
 * The video the viewer was watching on the card (the hero, the title's page), carried into the player
 * (`carry.ts`): it goes on playing over the player, at its own second and sound, while the player's own
 * stream loads underneath (muted: the caller mutes it while `carriedOn`) and starts at the matching second
 * (`handoff.at` plus the time the carried video went on playing meanwhile). Once that stream plays there,
 * it takes the sound and the carried video fades out: the viewer sees one video going on, not a black
 * screen and a restart. A stream that cannot play: the carried video goes, so the message is seen.
 *
 * Returns the box's ref callback (the carried video is put in it) and whether the carried video shows.
 */
export function useCarriedIn(
  id: string | undefined,
  video: HTMLVideoElement | null,
  handoff: PlayerHandoff | null,
): [(node: HTMLDivElement | null) => void, boolean] {
  const carried = useRef<Carried | null>(null);
  const [carriedOn, setCarriedOn] = useState(false);
  // The carried video's second at the tap: how far it went on playing is measured from it.
  const from = useRef(0);
  const tried = useRef(false);
  const synced = useRef(false);
  const at = handoff?.at ?? null;

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || tried.current || !id || !handoff) return;
      tried.current = true;
      const c = adopt(playerCarryKey(id));
      if (!c) return;
      node.appendChild(c.el);
      Object.assign(c.el.style, { transition: 'none', opacity: '1', objectFit: 'contain', background: '#000' });
      // From the tap, not from now: the player may have taken a moment to open, and the video played on.
      from.current = c.offeredAt ?? c.el.currentTime;
      void c.el.play().catch(() => undefined);
      carried.current = c;
      setCarriedOn(true);
    },
    [id, handoff],
  );

  // The player's own stream takes over (it gets the sound back from the caller): the carried video fades
  // out and is done with.
  const handOver = useCallback(() => {
    const c = carried.current;
    if (!c) return;
    carried.current = null;
    c.el.muted = true;
    c.el.style.transition = `opacity ${FADE_MS}ms ease`;
    c.el.style.opacity = '0';
    window.setTimeout(() => done(c), FADE_MS);
    setCarriedOn(false);
  }, []);

  // Underneath, the player's own stream starts at the second of the tap; once it plays, it goes to the
  // second the carried video is at now, and once it plays there, it takes over.
  useEffect(() => {
    if (!carriedOn || !video) return;
    const onPlaying = () => {
      const c = carried.current;
      if (!c) return;
      if (!synced.current) {
        synced.current = true;
        const target = at !== null ? at + Math.max(0, c.el.currentTime - from.current) : null;
        if (target !== null && Math.abs(video.currentTime - target) > 0.3) {
          video.currentTime = target;
          return;
        }
      }
      handOver();
    };
    const onSeeked = () => {
      if (synced.current && !video.paused) handOver();
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', handOver);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', handOver);
    };
  }, [carriedOn, video, at, handOver]);

  // Leaving the player before it took over: the carried video is done with (checked a moment later:
  // React may put the screen straight back, in development on purpose).
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.setTimeout(() => {
        const c = carried.current;
        if (mounted.current || !c) return;
        carried.current = null;
        done(c);
      }, 0);
    };
  }, []);

  return [attach, carriedOn];
}
