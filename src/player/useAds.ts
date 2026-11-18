import { useCallback, useEffect, useRef, useState } from 'react';
import { getAds, type AdBreak } from '@/lib/api/ads';
import { loadVast, ping, type VastAd } from '@/player/vast';

/** The ad on screen: what the ad `<video>` plays, and how long the viewer must wait to skip it. */
export interface AdOnScreen {
  src: string;
  /** `preroll`, `midroll` or `postroll`. */
  position: string;
  skipAfter: number | null;
  clickThrough: string | null;
  /** The ad `<video>` calls these as it plays. */
  onTime: (time: number, duration: number) => void;
  onMute: (muted: boolean) => void;
  onClick: () => void;
}

export interface Ads {
  /** Every break the CMS sent for this title (the seek bar draws a mark at each mid-roll). */
  breaks: AdBreak[];
  /** Set while an ad plays; the screen shows it over the video and swaps to the ad controls. */
  ad: AdOnScreen | null;
  /** The ad `<video>` ended, failed, or was skipped: back to the title. */
  finish: (how: 'complete' | 'skip' | 'error') => void;
}

/** Put the title back where it was (a function of its own: the element belongs to the screen). */
function resumeAt(el: HTMLVideoElement, time: number, play: boolean) {
  if (time > 0 && Math.abs(el.currentTime - time) > 0.5) el.currentTime = time;
  if (play) void el.play().catch(() => undefined);
}

/**
 * The ads of one title, played over its video. The CMS says where (`GET /v1/ads/{id}`: a pre-roll, mid-rolls
 * at a time, a post-roll) and the ad server fills each break (a VAST tag). The title's `<video>` is paused
 * while an ad plays in its own `<video>`, and carries on from where it was when the ad is over. A break whose
 * tag gives nothing, or fails, is left out: the viewer never waits on an ad that is not there.
 *
 * `video` is the title's element; it needs a stream (`hasStream`), so a title with no video has no ads.
 */
export function useAds(contentId: string | undefined, video: HTMLVideoElement | null, hasStream: boolean): Ads {
  const [loaded, setLoaded] = useState<{ id: string; breaks: AdBreak[] } | null>(null);
  const [onScreen, setOnScreen] = useState<{ id: string; ad: AdOnScreen } | null>(null);
  // Which breaks have played (by index): each plays once per visit, and a seek past a mid-roll plays it once.
  const played = useRef<Set<number>>(new Set());
  const busy = useRef(false);
  const resume = useRef<{ time: number; play: boolean } | null>(null);
  const current = useRef<{ vast: VastAd; quartiles: Set<string>; started: boolean; muted: boolean } | null>(null);

  const breaks = loaded && loaded.id === contentId ? loaded.breaks : EMPTY;
  const ad = onScreen && onScreen.id === contentId ? onScreen.ad : null;

  useEffect(() => {
    played.current = new Set();
    busy.current = false;
    current.current = null;
    resume.current = null;
    if (!contentId) return;
    let live = true;
    void getAds(contentId).then((b) => {
      if (live) setLoaded({ id: contentId, breaks: b });
    });
    return () => {
      live = false;
    };
  }, [contentId]);

  const finish = useCallback<Ads['finish']>(
    (how) => {
      const cur = current.current;
      if (cur) {
        const name = how === 'complete' ? 'complete' : how === 'skip' ? 'skip' : 'error';
        for (const u of cur.vast.events[name] ?? []) ping(u);
      }
      current.current = null;
      busy.current = false;
      setOnScreen(null);
      const back = resume.current;
      resume.current = null;
      // The title carries on from where it was (a pre-roll: from the start; a post-roll: it stays at the end).
      if (video && back) resumeAt(video, back.time, back.play);
    },
    [video],
  );

  const play = useCallback(
    async (index: number, brk: AdBreak, wasPlaying: boolean) => {
      if (!video || !brk.tagUrl || busy.current || !contentId) return;
      busy.current = true;
      played.current.add(index);
      video.pause();
      const post = brk.position === 'postroll';
      resume.current = { time: post ? 0 : video.currentTime, play: wasPlaying && !post };
      const vast = await loadVast(brk.tagUrl).catch(() => null);
      if (!vast) {
        // Nothing to show: the title goes on as if there were no break.
        busy.current = false;
        const back = resume.current;
        resume.current = null;
        if (back?.play) void video.play().catch(() => undefined);
        return;
      }
      current.current = { vast, quartiles: new Set(), started: false, muted: false };
      for (const u of vast.impressions) ping(u);
      const fire = (event: string) => {
        for (const u of current.current?.vast.events[event] ?? []) ping(u);
      };
      setOnScreen({
        id: contentId,
        ad: {
          src: vast.src,
          position: brk.position,
          skipAfter: vast.skipAfter,
          clickThrough: vast.clickThrough,
          onTime: (time, duration) => {
            const cur = current.current;
            if (!cur) return;
            if (!cur.started && time > 0) {
              cur.started = true;
              fire('start');
            }
            const frac = duration > 0 ? time / duration : 0;
            for (const [name, at] of [
              ['firstQuartile', 0.25],
              ['midpoint', 0.5],
              ['thirdQuartile', 0.75],
            ] as const) {
              if (frac >= at && !cur.quartiles.has(name)) {
                cur.quartiles.add(name);
                fire(name);
              }
            }
          },
          onMute: (muted) => {
            const cur = current.current;
            if (!cur || cur.muted === muted) return;
            cur.muted = muted;
            fire(muted ? 'mute' : 'unmute');
          },
          onClick: () => {
            const cur = current.current;
            if (!cur?.vast.clickThrough) return;
            for (const u of cur.vast.clickTracking) ping(u);
            window.open(cur.vast.clickThrough, '_blank', 'noopener');
          },
        },
      });
    },
    [video, contentId],
  );

  // Pre-roll: the title was told to play (a press, or autoplay): hold it, and play the ad first.
  // Mid-roll: the title's time reached it (or went past it, a seek). Post-roll: the title ended.
  useEffect(() => {
    if (!video || !hasStream || !breaks.length) return;
    const onPlay = () => {
      const pre = breaks.findIndex((b) => b.position === 'preroll');
      const brk = breaks[pre];
      if (busy.current || !brk || played.current.has(pre)) return;
      void play(pre, brk, true);
    };
    const onTime = () => {
      if (busy.current || video.paused) return;
      const due = breaks
        .map((b, i) => ({ b, i }))
        .filter(
          ({ b, i }) =>
            b.position === 'midroll' &&
            b.offsetSeconds !== null &&
            !played.current.has(i) &&
            video.currentTime >= b.offsetSeconds,
        );
      const last = due[due.length - 1];
      if (!last) return;
      // A seek past several: the latest plays, the ones passed are counted as played.
      for (const { i } of due.slice(0, -1)) played.current.add(i);
      void play(last.i, last.b, true);
    };
    const onEnded = () => {
      const post = breaks.findIndex((b) => b.position === 'postroll');
      const brk = breaks[post];
      if (busy.current || !brk || played.current.has(post)) return;
      void play(post, brk, false);
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnded);
    };
  }, [video, hasStream, breaks, play]);

  return { breaks, ad, finish };
}

const EMPTY: AdBreak[] = [];
