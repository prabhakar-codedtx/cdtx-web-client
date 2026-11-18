import { http } from '@/lib/api/client';
import type { Envelope } from '@/lib/api/types';

/** One ad break of a title, as the CMS sends it (`GET /v1/ads/{id}`): where, and which ad tag to ask. */
export interface AdBreak {
  position: 'preroll' | 'midroll' | 'postroll' | string;
  /** Mid-roll only: whole seconds from the start of the video. */
  offsetSeconds: number | null;
  /** The VAST address; null: the CMS has no tag for it, so nothing can play. */
  tagUrl: string | null;
}

interface TitleAds {
  contentId: string;
  enabled: boolean;
  source: string;
  breaks: AdBreak[];
}

/** The breaks that really play on a title (the product's switch and the title's choice already applied).
 * No ads, an unknown title, or a failure: an empty list, and the video plays as it always did. */
export async function getAds(contentId: string): Promise<AdBreak[]> {
  try {
    const { data } = await http.get<Envelope<TitleAds>>(`/v1/ads/${encodeURIComponent(contentId)}`);
    const ads = data.data[0];
    return ads?.enabled ? ads.breaks.filter((b) => b.tagUrl) : [];
  } catch {
    return [];
  }
}
