import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEpisodes, getTitle, path } from '@/lib/api/endpoints';
import type { Title } from '@/lib/api/types';
import { LOCALE, REGION } from '@/lib/config';
import { useDt } from '@/lib/device/useDt';
import type { Media, Option } from '@/player/useMedia';

export interface SubtitleFile {
  id: string;
  language: string;
  label: string;
  src: string;
}

export interface TitlePlayback {
  /** The title as `GET /v1/content/{id}` sends it (with its `playback`); null until it arrives. */
  title: Title | null;
  /** True when the title has qualities, audio languages or subtitles of its own. */
  ready: boolean;
  /** What the `<video>` plays: the chosen audio language's stream, else the chosen quality. */
  src: string | undefined;
  subtitleFiles: SubtitleFile[];
  /** The id of the subtitle shown (the `<track>` to switch on); null: off. */
  subtitleId: string | null;
  facts: { introMarkers: boolean; hasNext: boolean; hasEpisodes: boolean };
  /** What the controls offer, from the title: merged over the `<video>`'s own state by the screen. */
  extend: (media: Media) => Media;
}

const AUTO = 'auto';

/**
 * What the player offers for the title it plays, read from the API and nothing else: the qualities
 * the title has (1080p, 720p), its audio languages (Tamil, Telugu), its subtitles (English), its
 * intro, and the episodes of its own season. A title without them offers no choices.
 */
export function useTitlePlayback(
  id: string | undefined,
  video: HTMLVideoElement | null,
  say: (text: string) => void,
): TitlePlayback {
  const dt = useDt();
  const navigate = useNavigate();
  // What arrived and what was chosen belong to one title: another title starts again from nothing.
  const [loaded, setLoaded] = useState<{ id: string; title: Title | null; episodes: Title[] } | null>(null);
  const [choice, setChoice] = useState<{
    id?: string;
    quality: string;
    audioId: string | null;
    subtitleId: string | null;
  }>({
    quality: AUTO,
    audioId: null,
    subtitleId: null,
  });
  // Where to carry on after the stream changes (a new quality or language): the time and whether it played.
  const resume = useRef<{ time: number; playing: boolean } | null>(null);

  useEffect(() => {
    if (!id) return;
    let live = true;
    const ctx = { reg: REGION, locale: LOCALE, dt };
    Promise.all([getTitle(id, ctx).catch(() => null), getEpisodes(id, ctx).catch(() => [])]).then(
      ([t, list]) => live && setLoaded({ id, title: t, episodes: list }),
    );
    return () => {
      live = false;
    };
  }, [id, dt]);

  const here = loaded?.id === id ? loaded : null;
  const title = here?.title ?? null;
  const episodes = useMemo(() => here?.episodes ?? [], [here]);
  const mine = choice.id === id ? choice : { quality: AUTO, audioId: null, subtitleId: null };
  const { quality, audioId, subtitleId } = mine;
  const choose = (change: Partial<typeof choice>) => setChoice({ ...mine, id, ...change });

  const playback = title?.playback ?? null;
  const renditions = useMemo(() => playback?.renditions ?? [], [playback]);
  const audio = useMemo(() => playback?.audioTracks ?? [], [playback]);
  const subtitles = useMemo(() => playback?.subtitles ?? [], [playback]);
  const intro = playback?.intro ?? null;

  // Auto plays the best quality the title has (the first one, as the editor ordered them).
  const rendition = renditions.find((r) => r.label === quality) ?? renditions[0];
  const track = audio.find((a) => a.id === audioId) ?? audio[0];
  const src = track?.url ?? rendition?.url ?? title?.previewVideoUrl ?? undefined;

  const subtitleFiles = useMemo<SubtitleFile[]>(
    () =>
      subtitles
        .filter((s) => s.url)
        .map((s) => ({ id: s.id, language: s.language, label: s.label, src: path(s.url!) })),
    [subtitles],
  );

  // A new stream starts where the last one was.
  useEffect(() => {
    if (!video || !resume.current) return;
    const { time, playing } = resume.current;
    const carryOn = () => {
      video.currentTime = time;
      if (playing) void video.play().catch(() => undefined);
      resume.current = null;
    };
    video.addEventListener('loadedmetadata', carryOn, { once: true });
    return () => video.removeEventListener('loadedmetadata', carryOn);
  }, [video, src]);

  // The `<track>` of the chosen subtitle is shown, the others hidden.
  useEffect(() => {
    if (!video) return;
    const apply = () => {
      for (const t of Array.from(video.textTracks)) t.mode = t.id === subtitleId ? 'showing' : 'disabled';
    };
    apply();
    video.textTracks.addEventListener?.('addtrack', apply);
    return () => video.textTracks.removeEventListener?.('addtrack', apply);
  }, [video, subtitleId, subtitleFiles]);

  const index = episodes.findIndex((e) => e.id === id);
  const next = index >= 0 ? episodes[index + 1] : undefined;
  const play = (e: Title) =>
    navigate(`/play/${e.type ?? 'episode'}/${e.id}`, { replace: true, state: { title: e } });

  const extend = (media: Media): Media => {
    const keep = () => {
      resume.current = { time: video?.currentTime ?? 0, playing: Boolean(video && !video.paused) };
    };
    const options = (
      list: { id: string; label: string; detail?: string | null }[],
      on: string | null,
    ): Option[] =>
      list.map((o) => ({ id: o.id, label: o.label, detail: o.detail ?? null, selected: o.id === on }));
    return {
      ...media,
      audioOptions: options(audio, track?.id ?? null),
      subtitleOptions: options(subtitles, subtitleId),
      renditions:
        renditions.length === 0
          ? undefined
          : [
              ...(renditions.length > 1
                ? [{ id: AUTO, label: 'Auto', detail: null, selected: quality === AUTO }]
                : []),
              ...renditions.map((r) => ({
                id: r.label,
                label: r.label,
                detail: null,
                selected: quality !== AUTO && r.label === rendition?.label,
              })),
            ],
      episodes: episodes.map((e) => ({
        id: e.id,
        label: e.title ?? '',
        detail: e.episodeLabel,
        selected: e.id === id,
      })),
      episodeTitles: episodes,
      pickAudio: (aid) => {
        keep();
        choose({ audioId: aid });
        say(`Audio: ${audio.find((a) => a.id === aid)?.label ?? ''}`);
      },
      pickSubtitle: (sid) => {
        choose({ subtitleId: sid });
        say(sid ? `Subtitles: ${subtitles.find((s) => s.id === sid)?.label ?? ''}` : 'Subtitles off');
      },
      pickRendition: (label) => {
        keep();
        choose({ quality: label });
        say(label === AUTO ? 'Quality: Auto' : `Quality: ${label}`);
      },
      pickEpisode: (eid) => {
        const e = episodes.find((x) => x.id === eid);
        if (e && e.id !== id) play(e);
      },
      demo: {
        skipIntro: () => intro && media.seekTo(intro.end),
        nextEpisode: () => (next ? play(next) : say('This is the last episode.')),
      },
    };
  };

  return {
    title,
    ready: renditions.length + audio.length + subtitles.length > 0,
    src,
    subtitleFiles,
    subtitleId,
    facts: { introMarkers: intro !== null, hasNext: next !== undefined, hasEpisodes: episodes.length > 1 },
    extend,
  };
}
