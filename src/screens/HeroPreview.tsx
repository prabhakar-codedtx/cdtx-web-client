import { useEffect, useRef, useState } from 'react';
import type { CardVideo } from '@/lib/api/types';
import { attachSource } from '@/player/hls';

/**
 * The title's preview video, played as the card's video layer says (`card.video`, set in the CMS's
 * Component builder → Video): the picture shows first; once the layer's `trigger` holds (the card on
 * screen, focused or under the pointer) and `delaySec` has passed, the video fades in over the picture in
 * `fadeMs`. At its `end` it plays again (`loop`), fades back to the picture (`showThumbnail`) or holds
 * its last frame (`stop`). It starts muted unless the layer says otherwise and the browser allows sound
 * (browsers only start a video by itself when it is muted: refused, it starts muted).
 *
 * It waits while the card is off screen or the tab is hidden, and is not played at all for a viewer who
 * asked for less motion or to save data. A video that fails fades out: the picture is back. An MP4 or an
 * HLS stream (`.m3u8`, through hls.js: `attachSource`).
 */
export function HeroPreview({
  src,
  layer,
  muted,
  onMutedByBrowser,
  onPlayingChange,
}: {
  src: string;
  /** Drawn only while the layer's `trigger` holds (for `onFocus` / `onHover`, the caller removes it when
   * focus or the pointer goes, which takes the card back to its picture). */
  layer: CardVideo;
  muted: boolean;
  /** The browser refused to start it with sound: it plays muted instead. */
  onMutedByBrowser: () => void;
  /** True while the video is on screen (the card then shows its sound button). */
  onPlayingChange: (playing: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [shown, setShown] = useState(false);
  const [gone, setGone] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => document.visibilityState !== 'hidden');
  const active = onScreen && tabVisible;
  const allowed = !prefersStill();
  const loop = layer.end === 'loop';

  // Watch the box the video sits in (it is there from the start, even before the video is).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
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

  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);

  useEffect(() => onPlayingChange(shown && !gone), [shown, gone, onPlayingChange]);

  // The address, once the video is there: an MP4 as it is, an HLS stream (`.m3u8`) through hls.js,
  // starting at its lowest quality. One that cannot play: the picture.
  useEffect(() => {
    const v = video.current;
    if (!started || !v) return;
    const fail = () => {
      setGone(true);
      setShown(false);
    };
    return attachSource(v, src, { preview: true, onFail: fail });
  }, [started, src]);

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
  }, [active, started, gone, onMutedByBrowser]);

  const backToPicture = () => {
    setGone(true);
    setShown(false);
  };
  // `showThumbnail`: the video fades out over the layer's `fadeMs`, then goes; the picture is back.
  const fadeBack = () => {
    setShown(false);
    window.setTimeout(() => setGone(true), Math.max(0, layer.fadeMs));
  };

  return (
    <div ref={box} style={{ position: 'absolute', inset: 0 }}>
      {started && !gone && (
        <video
          ref={video}
          muted={muted}
          autoPlay
          playsInline
          loop={loop}
          preload="auto"
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setShown(true)}
          // `showThumbnail`: fade back to the picture; `stop`: hold the last frame.
          onEnded={layer.end === 'showThumbnail' ? fadeBack : undefined}
          onError={backToPicture}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: shown ? 1 : 0,
            transition: `opacity ${Math.max(0, layer.fadeMs)}ms ease`,
          }}
        />
      )}
    </div>
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
