import { useState } from 'react';
import type { Launch } from '@/lib/api/endpoints';
import { useLanguageScreen, type LanguageScreen } from '@/lib/api/languageScreen';
import { saveChoice, savedChoice } from '@/lib/language/choice';

export type LanguageGate =
  /** Asking whether the screen shows. */
  | { status: 'checking' }
  /** The viewer has to choose (a new viewer, the screen on). */
  | { status: 'show'; screen: LanguageScreen }
  /** Straight in: already chosen, the screen is off, or the server has none. */
  | { status: 'done' };

/**
 * Whether the "Choose your language" screen stands in front of the app. It does for a viewer who has
 * not chosen yet, when the CMS has the screen on for this device and wants it on the first visit
 * (`showFirstVisit`; when off the viewer is only offered it in the profile menu). Anything that goes wrong (an older
 * server, a failed call) lets the viewer in: the screen must never be the reason nothing opens.
 */
export function useLanguageGate(launch: Launch | null): {
  gate: LanguageGate;
  choose: (codes: string[], skipped: boolean) => void;
} {
  // A viewer who has chosen before is never asked again (read once, at the start).
  const [chosen] = useState(() => savedChoice() !== null);
  const { loading, screen } = useLanguageScreen(chosen ? null : launch);
  const gate: LanguageGate = chosen
    ? { status: 'done' }
    : !launch || loading
      ? { status: 'checking' }
      : screen && screen.showFirstVisit !== false
        ? { status: 'show', screen }
        : { status: 'done' };

  /** Keep the choice and start again, so every call is made in the chosen language. */
  const choose = (codes: string[], skipped: boolean) => {
    saveChoice({ codes, skipped });
    window.location.reload();
  };

  return { gate, choose };
}
