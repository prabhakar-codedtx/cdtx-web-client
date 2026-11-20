import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { CardVideo, VideoPlayback } from '@/lib/api/types';
import type { VideoClock } from '@/player/handoff';
import { attachSource } from '@/player/hls';
import { adopt, done, forget, giveBack, isOffered, offer, orphan, type Carried } from '@/player/carry';

/**
 * The title's preview video, played as the card's video layer says (`card.video`, set in the CMS's
 * Component builder → Player): the picture shows first; once the layer's `trigger` holds (the card on
 * screen, focused or under the pointer) and `delaySec` has passed, the video fades in over the picture in
 * `fadeMs`. At its `end` it plays again (`loop`), fades back to the picture (`showThumbnail`) or holds
 * its last frame (`stop`). It starts muted unless the layer says otherwise and the browser allows sound
 * (browsers only start a video by itself when it is muted: refused, it starts muted).
 *
 * It waits while the card is off screen or the tab is hidden, and is not played at all for a viewer who
 * asked for less motion or to save data. A video that fails fades out: the picture is back. An MP4 or an
 * HLS stream (`.m3u8`, through hls.js: `attachSource`).
 *
 * The video element is made here, not by React, so it can be carried (`carry.ts`): handed on to the next
 * screen showing the same title (the detail page the hero opens), where it goes on playing at the same
 * second, and given back when that screen goes.
 */
export function HeroPreview({
  src,
  layer,
  muted,
  onMutedByBrowser,
  onPlayingChange,
  clockRef,
  onTap,
  carryKey,
  carryRef,
  onCarriedIn,
  onEnded,
}: {
  src: string;
  /** Drawn only while the layer's `trigger` holds (for `onFocus` / `onHover`, the caller removes it when
   * focus or the pointer goes, which takes the card back to its picture). A Video atom's settings too. */
  layer: CardVideo | VideoPlayback;
  /** Set to where the video is (its second, its sound) while it plays, else null: what the card's Play
   * button carries on from. */
  clockRef?: MutableRefObject<(() => VideoClock) | null>;
  /** A tap on the playing video (with where it was); unset, or before it plays: the tap is the card's. */
  onTap?: (at: VideoClock) => void;
  muted: boolean;
  /** The browser refused to start it with sound: it plays muted instead. */
  onMutedByBrowser: () => void;
  /** True while the video is on screen (the card then shows its sound button). */
  onPlayingChange: (playing: boolean) => void;
  /** The title and its video (`carry.ts`): a video of the same key handed over by the screen before (the
   * hero the viewer tapped) carries on here at once, with no picture first; this one can be handed on. */
  carryKey?: string;
  /** Set while the video plays: hands it over to the next screen showing the same title (call it just
   * before going there). Unset `key`: the title's page (`carryKey`); `playerCarryKey(id)`: the player. */
  carryRef?: MutableRefObject<((key?: string) => void) | null>;
  /** A video carried in from the screen before: its sound, for the card's sound button. */
  onCarriedIn?: (muted: boolean) => void;
  /** The video ended and its `end` is `next`: the hero goes on to its next slide. */
  onEnded?: () => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const release = useRef<(() => void) | null>(null);
  const unwire = useRef<(() => void) | null>(null);
  // Bumped whenever an element is made, carried in or given back: the effects below follow it.
  const [own, setOwn] = useState(0);
  // Handed on to the next screen: this one shows its picture until the video comes back.
  const [away, setAway] = useState(false);
  // A video carried in from the screen before has started already (no picture first).
  const [started, setStarted] = useState(() => Boolean(carryKey && isOffered(carryKey)));
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState !== 'hidden');
  const active = onScreen && tabVisible;
  const allowed = !prefersStill();
  const loop = layer.end === 'loop';
  const endRef = useRef(layer.end);
  const fadeRef = useRef(layer.fadeMs);
  const mutedRef = useRef(muted);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
    endRef.current = layer.end;
    fadeRef.current = layer.fadeMs;
    mutedRef.current = muted;
  });

  // The element's own events, for whichever screen holds it now.
  const wire = useCallback((el: HTMLVideoElement) => {
    unwire.current?.();
    const playing = () => setShown(true);
    const failed = () => {
      setGone(true);
      setShown(false);
    };
    // `showThumbnail`: the video fades out over the layer's `fadeMs`, then goes; the picture is back.
    const ended = () => {
      if (endRef.current === 'next') {
        onEndedRef.current?.();
        return;
      }
      if (endRef.current !== 'showThumbnail') return;
      setShown(false);
      window.setTimeout(() => setGone(true), Math.max(0, fadeRef.current));
    };
    el.addEventListener('playing', playing);
    el.addEventListener('error', failed);
    el.addEventListener('ended', ended);
    unwire.current = () => {
      el.removeEventListener('playing', playing);
      el.removeEventListener('error', failed);
      el.removeEventListener('ended', ended);
      unwire.current = null;
    };
  }, []);

  // Puts an element (made here, carried in or given back) in this screen's box and follows it.
  const take = useCallback(
    (c: Carried) => {
      holder.current?.appendChild(c.el);
      video.current = c.el;
      release.current = c.release;
      wire(c.el);
      setAway(false);
      setOwn((n) => n + 1);
    },
    [wire],
  );

  // The next screen took the video.
  const lose = useCallback(() => {
    unwire.current?.();
    video.current = null;
    release.current = null;
    setAway(true);
    setShown(false);
  }, []);

  // A carried video, in this box at once: already playing, no fade.
  const takePlaying = useCallback(
    (c: Carried) => {
      take(c);
      c.el.style.transition = 'none';
      c.el.style.opacity = '1';
      setShown(true);
      void c.el.play().catch(() => undefined);
    },
    [take],
  );

  // Carried in from the screen before: it plays on here at once, at its own second and sound.
  // Done as the box is put in the page (once): the video moves straight into it, so it never stops.
  const adoptedMuted = useRef<boolean | null>(null);
  const tried = useRef(false);
  const attachHolder = useCallback(
    (node: HTMLDivElement | null) => {
      holder.current = node;
      if (!node || tried.current || !carryKey) return;
      tried.current = true;
      const c = adopt(carryKey);
      if (!c) return;
      adoptedMuted.current = c.el.muted;
      takePlaying(c);
      onCarriedIn?.(c.el.muted);
    },
    [carryKey, takePlaying, onCarriedIn],
  );

  // Watch the box the video sits in (it is there from the start, even before the video is).
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e && setOnScreen(e.intersectionRatio > 0.25), {
      threshold: [0, 0.25, 0.5],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const on = () => setTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  // The picture first: the video is added only after the delay, while the card can be seen.
  useEffect(() => {
    if (!allowed || started || gone || !active) return;
    const t = window.setTimeout(() => setStarted(true), Math.max(0, layer.delaySec) * 1000);
    return () => window.clearTimeout(t);
  }, [allowed, started, gone, active, layer.delaySec]);

  // Once started: the element and its address. An MP4 as it is, an HLS stream (`.m3u8`) through hls.js,
  // starting at its lowest quality. One that cannot play: the picture.
  useEffect(() => {
    if (!started || gone || away || video.current) return;
    const el = document.createElement('video');
    el.muted = mutedRef.current;
    el.autoplay = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    Object.assign(el.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: '0',
    });
    const fail = () => {
      setGone(true);
      setShown(false);
    };
    take({ el, release: attachSource(el, src, { preview: true, onFail: fail }) });
  }, [started, gone, away, src, take]);

  // Gone (failed, or faded back to the picture): the element goes too.
  useEffect(() => {
    if (!gone) return;
    const el = video.current;
    if (!el) return;
    unwire.current?.();
    done({ el, release: release.current ?? (() => undefined) });
    video.current = null;
    release.current = null;
  }, [gone]);

  // When this screen goes: the video goes back to the screen it came from, waits for the next one (it was
  // just handed on, the next screen is still loading), or is done with.
  // Checked a moment later, not at once: React may put the same screen straight back (in development it
  // does so on purpose), and then nothing has gone.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.setTimeout(() => {
        if (mounted.current) return;
        forget(takePlaying);
        const el = video.current;
        if (!el) return;
        unwire.current?.();
        video.current = null;
        const carried = { el, release: release.current ?? (() => undefined) };
        release.current = null;
        if (carryKey && giveBack(carryKey, carried)) return;
        // Handed on and still waiting for the next screen: it goes on waiting there.
        if (orphan(el)) return;
        done(carried);
      }, 0);
    };
    // Only when this screen goes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // The first time after a video was carried in, its own sound stays (the card's button follows it).
    if (adoptedMuted.current !== null) {
      const m = adoptedMuted.current;
      adoptedMuted.current = null;
      if (m !== muted) return;
    }
    v.muted = muted;
  }, [muted, own]);

  useEffect(() => {
    if (video.current) video.current.loop = loop;
  }, [loop, own]);

  // Shown: the video fades in over the picture in `fadeMs` (a carried one is already there).
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (v.style.transition !== 'none' || !shown) v.style.transition = `opacity ${Math.max(0, layer.fadeMs)}ms ease`;
    v.style.opacity = shown ? '1' : '0';
  }, [shown, own, layer.fadeMs]);

  const playing = shown && !gone && !away;
  useEffect(() => onPlayingChange(playing), [playing, onPlayingChange]);

  // Where the video is, for the Play button: only while it is on screen.
  useEffect(() => {
    if (!clockRef) return;
    clockRef.current = playing
      ? () => ({ time: video.current?.currentTime ?? 0, muted: video.current?.muted ?? true })
      : null;
    return () => {
      clockRef.current = null;
    };
  }, [clockRef, playing]);

  // Handing it on: only while it plays here.
  useEffect(() => {
    if (!carryRef) return;
    carryRef.current =
      playing && carryKey
        ? (key = carryKey) => {
            const el = video.current;
            if (el) offer(key, { el, release: release.current ?? (() => undefined) }, takePlaying, lose);
          }
        : null;
    return () => {
      carryRef.current = null;
    };
  }, [carryRef, playing, carryKey, takePlaying, lose]);

  // Off screen or in a hidden tab: paused; back again: it carries on. Sound refused: muted instead.
  useEffect(() => {
    const v = video.current;
    if (!v || gone) return;
    if (!active) {
      v.pause();
      return;
    }
    v.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'NotAllowedError' && !v.muted) {
        v.muted = true;
        onMutedByBrowser();
        void v.play().catch(() => undefined);
      }
    });
  }, [active, started, gone, own, onMutedByBrowser]);

  const tappable = playing && Boolean(onTap);
  return (
    <div
      ref={attachHolder}
      // A tap on the playing video is the video's own (it carries on); before it plays, the card's.
      onClick={
        tappable
          ? (e) => {
              e.stopPropagation();
              e.preventDefault();
              const v = video.current;
              onTap?.({ time: v?.currentTime ?? 0, muted: v?.muted ?? true });
            }
          : undefined
      }
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: tappable ? 'auto' : 'none',
        cursor: tappable ? 'pointer' : undefined,
      }}
    />
  );
}

/** The video layer of a card that has none of its own: the whole card, as before the CMS could say. */
export const DEFAULT_CARD_VIDEO: CardVideo = {
  source: 'preview',
  area: 'card',
  left: null,
  top: null,
  width: null,
  height: null,
  shapePolygon: [],
  trigger: 'onScreen',
  delaySec: 2,
  fadeMs: 600,
  end: 'loop',
  startMuted: true,
  zIndex: 25,
};

/** The viewer asked for less motion, or for less data: the picture stays. */
function prefersStill(): boolean {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return reduce || saveData === true;
}
