import { useEffect, useState } from 'react';
import { http } from '@/lib/api/client';
import { path, type Launch } from '@/lib/api/endpoints';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import type { Block, DeliveryContext, Envelope, Title } from '@/lib/api/types';

/** One language the screen offers. `item` is the title a Content Block card is drawn with. */
export interface ScreenLanguage {
  code: string;
  name: string;
  nativeName: string | null;
  imageUrl: string | null;
  isDefault: boolean;
  item: Record<string, unknown>;
}

/** The "Choose your language" screen for this device (`GET /v1/launch/language-screen`). */
export interface LanguageScreen {
  /** False: the screen is off (or has no language on) and the app goes straight in. */
  enabled: boolean;
  device: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  skippable: boolean;
  skipLabel: string;
  selectMode: 'single' | 'multi';
  minSelect: number;
  maxSelect: number | null;
  layout: 'grid' | 'list' | 'chips';
  tileShape: 'card' | 'pill' | 'circle';
  columns: number | null;
  showPicture: boolean;
  showNativeName: boolean;
  showEnglishName: boolean;
  theme: 'dark' | 'light';
  backgroundUrl: string | null;
  /** The Content Block each language is drawn with, as a rail's card is sent; null = the built-in tile. */
  cardBlockId: string | null;
  card: Block | null;
  languages: ScreenLanguage[];
}

/** The language screen, or null when the server has none (an older server) or it cannot be read:
 * the app then goes straight in, never stuck on a screen it cannot draw. */
export async function getLanguageScreen(
  launch: Launch,
  ctx: DeliveryContext,
): Promise<LanguageScreen | null> {
  const url = launch.raw.languageScreenURL;
  if (typeof url !== 'string' || !url) return null;
  try {
    const { data } = await http.get<Envelope<LanguageScreen>>(path(url), { params: { device: ctx.dt } });
    return data.data[0] ?? null;
  } catch {
    return null;
  }
}

/** A language as the title its Content Block card reads. */
export function languageTitle(lang: ScreenLanguage): Title {
  return {
    slug: null,
    type: null,
    description: null,
    releaseYear: null,
    durationSeconds: null,
    rating: null,
    genres: [],
    languages: [],
    videoQuality: [],
    audioQuality: [],
    episodeLabel: null,
    badges: {} as Title['badges'],
    images: [],
    logoUrl: null,
    previewVideoUrl: null,
    availableUntil: null,
    entitlements: null,
    ...lang.item,
    id: lang.code,
  } as unknown as Title;
}

const loaded = new Map<string, Promise<LanguageScreen | null>>();

/** The same screen asked for once per address and device, however many places need it (the first-visit
 * gate, the profile menu, the Language page). A failed read is not kept: the next ask tries again. */
export function loadLanguageScreen(launch: Launch, ctx: DeliveryContext): Promise<LanguageScreen | null> {
  const url = launch.raw.languageScreenURL;
  if (typeof url !== 'string' || !url) return Promise.resolve(null);
  const key = `${url}|${ctx.dt}`;
  let p = loaded.get(key);
  if (!p) {
    p = getLanguageScreen(launch, ctx).then((screen) => {
      if (screen === null) loaded.delete(key);
      return screen;
    });
    loaded.set(key, p);
  }
  return p;
}

/**
 * The language screen when the CMS has it on for this device (`enabled`, with a language to pick),
 * else null. `loading` is true until the first answer.
 */
export function useLanguageScreen(launch: Launch | null): {
  loading: boolean;
  screen: LanguageScreen | null;
} {
  const [state, setState] = useState<{ key: string; screen: LanguageScreen | null } | null>(null);
  const url = launch?.raw.languageScreenURL;
  const key = typeof url === 'string' ? url : '';
  useEffect(() => {
    if (!launch || !key) return;
    let live = true;
    void loadLanguageScreen(launch, getDeliveryContext()).then((screen) => {
      if (live) setState({ key, screen: screen?.enabled && screen.languages.length > 0 ? screen : null });
    });
    return () => {
      live = false;
    };
  }, [launch, key]);
  // Waiting for the launch config; or the server sends no language screen at all.
  if (!launch) return { loading: true, screen: null };
  if (!key) return { loading: false, screen: null };
  return state?.key === key ? { loading: false, screen: state.screen } : { loading: true, screen: null };
}
