import type { PreviewHandoff, Title, VideoPlayback } from '@/lib/api/types';

/**
 * A card's video carried into the player: where the player starts (`at`, seconds; null = the beginning,
 * or the viewer's Continue watching point), whether it starts muted (the card's sound carries over), and
 * the address to play when it is not the title's own stream (`src`: the trailer the card was playing —
 * the player then keeps no Continue watching progress for it).
 */
export interface PlayerHandoff {
  at: number | null;
  muted: boolean;
  src?: string;
  /** The pre-roll ad: `skip`ped (the video carries on; the default) or `play`ed first (the CMS's
   * "Ad before the player"). */
  preroll?: 'skip' | 'play';
}

/** Where the card's video is when it is tapped: its second and its sound. */
export interface VideoClock {
  time: number;
  muted: boolean;
}

/** What to do with a tap on a card's playing video, or with its Play button. */
export type HandoffStep =
  | { to: 'player'; handoff: PlayerHandoff }
  | { to: 'detail' }
  /** Nothing of the video's own: the tap (or the Play button) does what it always does. */
  | null;

/**
 * The server says what the card's video is (`title.previewHandoff`) and what a tap on it does (the
 * video's `onTap`, `playButtonContinues`); this turns that and the video's second into the step to take.
 *
 * - A tap: `openPlayer` carries on (a trailer or the title itself at the same second; a preview cut from the
 *   title at `offsetSec` + the second; any other preview from the beginning), `openPlayerFromStart` starts
 *   over, `openDetail` opens the page, `none` leaves the tap to the card.
 * - The Play button: carries on only when the card plays the title itself or a cut of it (target `main`
 *   with a known offset) and the video allows it; otherwise it plays as it always does.
 */
export function handoffStep(
  title: Title,
  playback: Pick<VideoPlayback, 'onTap' | 'playButtonContinues'>,
  clock: VideoClock,
  how: 'tap' | 'playButton',
): HandoffStep {
  const h: PreviewHandoff | null | undefined = title.previewHandoff;
  if (how === 'playButton') {
    if (playback.playButtonContinues === false || h?.target !== 'main' || h.offsetSec === null) return null;
    return { to: 'player', handoff: { at: h.offsetSec + clock.time, muted: clock.muted } };
  }
  switch (playback.onTap ?? 'openPlayer') {
    case 'none':
      return null;
    case 'openDetail':
      return { to: 'detail' };
    case 'openPlayerFromStart':
      return { to: 'player', handoff: { at: null, muted: clock.muted } };
    default:
      if (h?.target === 'trailer' && title.previewVideoUrl) {
        return { to: 'player', handoff: { at: clock.time, muted: clock.muted, src: title.previewVideoUrl } };
      }
      return {
        to: 'player',
        handoff: { at: h?.offsetSec != null ? h.offsetSec + clock.time : null, muted: clock.muted },
      };
  }
}

/**
 * A Trailer button. The card's playing video is this trailer (`previewKind: trailer`): the player carries
 * on with it at the same second, with the same sound. Otherwise the player plays the title's trailer
 * (`trailerUrl`) from its beginning, with the card's sound (from no card: with sound). No trailer: null.
 * A trailer is not the title: no Continue watching progress is saved for it (`src` is set).
 */
export function trailerStep(title: Title, clock: VideoClock | null): HandoffStep {
  if (clock && title.previewKind === 'trailer' && title.previewVideoUrl) {
    return { to: 'player', handoff: { at: clock.time, muted: clock.muted, src: title.previewVideoUrl } };
  }
  // With the card's sound (the CMS's "Player sound" may turn it on); from no card: with sound.
  if (title.trailerUrl) {
    return { to: 'player', handoff: { at: null, muted: clock?.muted ?? false, src: title.trailerUrl } };
  }
  return null;
}
