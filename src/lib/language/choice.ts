import { LOCALE, PRODUCT } from '@/lib/config';

/**
 * The language the viewer chose on the language screen, kept in this browser (per product). The
 * first chosen language is the `locale` of every delivery call, so titles and texts come in it
 * (the API falls back to English where a title has no translation).
 */

const KEY = `cdtx.language.${PRODUCT}`;

export interface LanguageChoice {
  /** The languages picked, in the order the screen lists them; the first is the one asked for. */
  codes: string[];
  /** The viewer left the screen without picking (the default language was used). */
  skipped: boolean;
}

/** What the viewer chose before, or null when they have not seen the screen yet. */
export function savedChoice(): LanguageChoice | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<LanguageChoice> | null;
    if (!raw || !Array.isArray(raw.codes)) return null;
    const codes = raw.codes.filter(
      (c): c is string => typeof c === 'string' && /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(c),
    );
    return { codes, skipped: raw.skipped === true };
  } catch {
    return null;
  }
}

export function saveChoice(choice: LanguageChoice): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Storage blocked (private mode): the screen shows again on the next visit.
  }
}

/** Forget the choice, so the screen shows again (a "Change language" action). */
export function clearChoice(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing kept
  }
}

/** The `locale` to ask the API for: the chosen language, else the build's default. */
export function chosenLocale(): string {
  return savedChoice()?.codes[0] ?? LOCALE;
}
