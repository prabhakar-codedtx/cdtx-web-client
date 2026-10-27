import { useEffect, useState } from 'react';
import { useAppSelector } from '@/app/hooks';
import { getPlayerConfig, type PlayerConfigAnswer } from '@/lib/api/endpoints';
import type { PlayerConfig } from '@/lib/api/player';
import { useDt } from '@/lib/device/useDt';
import { adaptPlayerConfig } from '@/player/adapt';

export interface PlayerConfigState {
  status: 'loading' | 'ready';
  config: PlayerConfig | null;
  /**
   * `server`: the product's published player. `sample`: the backend's sample layout, used only in
   * development (or with `VITE_PLAYER_SAMPLE=on`) while the server has none published. `none`: no
   * layout; the built-in player is shown.
   */
  source: 'server' | 'sample' | 'none';
  /** What the server said: the address asked, its status and `tracking_id` (for a support ticket). */
  answer: PlayerConfigAnswer | null;
}

const useSample = import.meta.env.DEV || import.meta.env.VITE_PLAYER_SAMPLE === 'on';

/** The backend's sample layout for this device class (copied from the CMS repo's samples). */
async function sampleFor(dt: string): Promise<PlayerConfig> {
  const mod =
    dt === 'androidtv' || dt === 'androidstb'
      ? await import('@/player/samples/androidtv-with-panels.json')
      : await import('@/player/samples/web.json');
  return mod.default as unknown as PlayerConfig;
}

/**
 * The player's layout for this device, from
 * `https://3-109-241-147.sslip.io/v1/player-config/sunnxt?dt={device type}` (the API host and product
 * of this build): asked when the player opens, kept by its ETag.
 */
export function usePlayerConfig(): PlayerConfigState {
  const launch = useAppSelector((s) => s.launch.launch);
  const dt = useDt();
  const [state, setState] = useState<PlayerConfigState>({
    status: 'loading',
    config: null,
    source: 'none',
    answer: null,
  });

  useEffect(() => {
    if (!launch) return;
    let live = true;
    void (async () => {
      const answer = await getPlayerConfig(launch, dt);
      if (answer.config) {
        // The server sends schema 4; the player draws schema 3's shape (`adapt.ts`).
        const config = adaptPlayerConfig(answer.config);
        if (live) setState({ status: 'ready', config, source: 'server', answer });
        return;
      }
      const sample = useSample ? await sampleFor(dt) : null;
      if (live) setState({ status: 'ready', config: sample, source: sample ? 'sample' : 'none', answer });
    })();
    return () => {
      live = false;
    };
  }, [launch, dt]);

  return state;
}
