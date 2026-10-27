/**
 * DEMO ONLY, for the UI team. The API has no audio or subtitle tracks, no episodes of a season, no next
 * episode and no intro markers yet, so the controls that need them stay hidden. For one title (Paper
 * Kingdoms) this fills them in with sample data, so every control of the player can be seen and tried.
 *
 * To remove it: delete this file, the `demo` lines in `PlayerScreen.tsx` and the `demo` lines in
 * `useMedia.ts`, `Panel.tsx` and `PlayerControls.tsx` (search for "demo"). `VITE_PLAYER_DEMO=off` turns
 * it off without deleting anything.
 */
import { useMemo, useState } from 'react';
import type { Title } from '@/lib/api/types';
import type { Media, Option } from '@/player/useMedia';

/** A sample episode as a title, so the Episodes card has a picture and a duration. */
const asTitle = ([id, label, detail]: [string, string, string]): Title =>
  ({
    id,
    title: label,
    episodeLabel: detail,
    durationSeconds: 2400,
    images: [{ aspect: '0-16x9', url: `https://picsum.photos/seed/${id}/640/360`, fallback: false }],
  }) as unknown as Title;

/** The one title the demo is for. */
export const DEMO_TITLE_ID = '98926ba8-7f0a-4b17-aa1d-b1c9a91770a6';

export const demoOn = (titleId: string | undefined): boolean =>
  import.meta.env.VITE_PLAYER_DEMO !== 'off' && titleId === DEMO_TITLE_ID;

/** Skip intro jumps here (seconds). */
export const DEMO_INTRO_END = 8;

const AUDIO: [string, string, string | null][] = [
  ['en', 'English', '5.1'],
  ['hi', 'Hindi', '2.0'],
  ['ta', 'Tamil', '2.0'],
];
const SUBTITLES: [string, string][] = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['ta', 'Tamil'],
];
const RENDITIONS: [string, string, string | null][] = [
  ['auto', 'Auto', null],
  ['1080', '1080p', 'Full HD'],
  ['720', '720p', 'HD'],
  ['480', '480p', null],
];
const EPISODES: [string, string, string][] = [
  ['e1', 'The Paper Throne', 'S1 E1'],
  ['e2', 'Folded Allegiances', 'S1 E2'],
  ['e3', 'A War of Origami', 'S1 E3'],
  ['e4', 'The Last Crease', 'S1 E4'],
  ['e5', 'Ink and Ash', 'S1 E5'],
];

/** `media` with the sample tracks, renditions and episodes (and what choosing them does) when `on`. */
export function useDemoMedia(media: Media, on: boolean, say: (text: string) => void): Media {
  const [audio, setAudio] = useState('en');
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [rendition, setRendition] = useState('auto');
  const [episode, setEpisode] = useState('e1');

  return useMemo<Media>(() => {
    if (!on) return media;
    const pick = <T extends string>(list: [T, string, string | null][], current: string): Option[] =>
      list.map(([id, label, detail]) => ({ id, label, detail, selected: id === current }));
    return {
      ...media,
      audioOptions: pick(AUDIO, audio),
      subtitleOptions: SUBTITLES.map(([id, label]) => ({
        id,
        label,
        detail: null,
        selected: id === subtitle,
      })),
      renditions: pick(RENDITIONS, rendition),
      episodes: EPISODES.map(([id, label, detail]) => ({ id, label, detail, selected: id === episode })),
      episodeTitles: EPISODES.map(asTitle),
      pickAudio: (id) => {
        setAudio(id);
        say(`Audio: ${AUDIO.find((a) => a[0] === id)?.[1]} (demo)`);
      },
      pickSubtitle: (id) => {
        setSubtitle(id);
        say(id ? `Subtitles: ${SUBTITLES.find((s) => s[0] === id)?.[1]} (demo)` : 'Subtitles off (demo)');
      },
      pickRendition: (id) => {
        setRendition(id);
        say(`Quality: ${RENDITIONS.find((r) => r[0] === id)?.[1]} (demo)`);
      },
      pickEpisode: (id) => {
        setEpisode(id);
        media.seekTo(0);
        say(`Playing ${EPISODES.find((e) => e[0] === id)?.[1]} (demo)`);
      },
      demo: {
        skipIntro: () => media.seekTo(DEMO_INTRO_END),
        nextEpisode: () => {
          const i = EPISODES.findIndex((e) => e[0] === episode);
          const next = EPISODES[(i + 1) % EPISODES.length]!;
          setEpisode(next[0]);
          media.seekTo(0);
          say(`Next episode: ${next[1]} (demo)`);
        },
      },
    };
  }, [media, on, audio, subtitle, rendition, episode, say]);
}
