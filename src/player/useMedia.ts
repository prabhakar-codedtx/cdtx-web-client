import { useCallback, useEffect, useRef, useState } from 'react';
import type { Title } from '@/lib/api/types';

/** One choice of a panel: `{label, detail, selected}` as the player-config guide defines it. */
export interface Option {
  id: string;
  label: string;
  detail: string | null;
  selected: boolean;
}

export interface Media {
  playing: boolean;
  time: number;
  /** The stream's own duration, else the title's `durationSeconds`, else 0. */
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  toggle: () => void;
  seekTo: (seconds: number) => void;
  seekBy: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setRate: (r: number) => void;
  audioOptions: Option[];
  subtitleOptions: Option[];
  pickAudio: (id: string) => void;
  pickSubtitle: (id: string | null) => void;
  /** demo only (`demo.ts`): sample quality levels, season episodes and what Skip intro / Next episode do. */
  renditions?: Option[];
  episodes?: Option[];
  /** The titles behind `episodes`, for the Episodes card. */
  episodeTitles?: Title[];
  pickRendition?: (id: string) => void;
  pickEpisode?: (id: string) => void;
  demo?: Record<string, () => void>;
}

interface AudioTrackLike {
  id: string;
  label: string;
  language: string;
  kind: string;
  enabled: boolean;
}

const audioTracksOf = (v: HTMLVideoElement | null): AudioTrackLike[] => {
  const list = (v as unknown as { audioTracks?: ArrayLike<AudioTrackLike> } | null)?.audioTracks;
  return list ? Array.from(list) : [];
};

/**
 * The state of the `<video>` the controls drive, and what they can do to it. The player config says
 * which controls exist and where; this is the playback they act on. `v` is the element (kept in
 * state by the screen, so a new element is listened to again).
 */
export function useMedia(v: HTMLVideoElement | null, fallbackDuration: number | null): Media {
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((t) => t + 1), []);
  // What the controls change is changed on the element itself, from their handlers.
  const el = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    el.current = v;
  }, [v]);
  const subtitleTracks = (m: HTMLVideoElement | null) =>
    m ? Array.from(m.textTracks).filter((t) => t.kind === 'subtitles' || t.kind === 'captions') : [];

  useEffect(() => {
    if (!v) return;
    const events = [
      'play',
      'pause',
      'timeupdate',
      'durationchange',
      'volumechange',
      'ratechange',
      'loadedmetadata',
      'emptied',
    ];
    for (const e of events) v.addEventListener(e, redraw);
    v.textTracks.addEventListener?.('change', redraw);
    v.textTracks.addEventListener?.('addtrack', redraw);
    return () => {
      for (const e of events) v.removeEventListener(e, redraw);
      v.textTracks.removeEventListener?.('change', redraw);
      v.textTracks.removeEventListener?.('addtrack', redraw);
    };
  }, [v, redraw]);

  const duration = v && Number.isFinite(v.duration) && v.duration > 0 ? v.duration : (fallbackDuration ?? 0);
  const text = subtitleTracks(v);
  const audio = audioTracksOf(v);

  return {
    playing: Boolean(v && !v.paused && !v.ended),
    time: v?.currentTime ?? 0,
    duration,
    volume: v?.volume ?? 1,
    muted: v?.muted ?? false,
    rate: v?.playbackRate ?? 1,
    toggle: () => {
      const m = el.current;
      if (!m) return;
      if (m.paused) void m.play().catch(() => undefined);
      else m.pause();
    },
    seekTo: (sec) => {
      const m = el.current;
      if (m) m.currentTime = Math.max(0, Math.min(duration || sec, sec));
    },
    seekBy: (sec) => {
      const m = el.current;
      if (m) m.currentTime = Math.max(0, Math.min(duration || m.currentTime + sec, m.currentTime + sec));
    },
    setVolume: (x) => {
      const m = el.current;
      if (m) m.volume = Math.max(0, Math.min(1, x));
    },
    toggleMute: () => {
      const m = el.current;
      if (m) m.muted = !m.muted;
    },
    setRate: (r) => {
      const m = el.current;
      if (m) m.playbackRate = r;
    },
    audioOptions: audio.map((t) => ({
      id: t.id,
      label: t.label || t.language,
      detail: t.kind || null,
      selected: t.enabled,
    })),
    subtitleOptions: text.map((t, i) => ({
      id: t.id || String(i),
      label: t.label || t.language,
      detail: null,
      selected: t.mode === 'showing',
    })),
    pickAudio: (id) => {
      for (const t of audioTracksOf(el.current)) t.enabled = t.id === id;
      redraw();
    },
    pickSubtitle: (id) => {
      subtitleTracks(el.current).forEach((t, i) => {
        t.mode = id !== null && (t.id || String(i)) === id ? 'showing' : 'disabled';
      });
      redraw();
    },
  };
}

/** Seconds as `m:ss` or `h:mm:ss` (`mm:ss` keeps two digits for minutes). */
export function clock(seconds: number, format?: string): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  if (h) return `${h}:${String(m).padStart(2, '0')}:${sec}`;
  return `${format === 'mm:ss' ? String(m).padStart(2, '0') : m}:${sec}`;
}
