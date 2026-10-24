import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { showToast } from '@/app/uiSlice';
import type { Title } from '@/lib/api/types';
import { useElementWidth, useViewportHeight } from '@/lib/device/useElementWidth';
import { imageFor } from '@/lib/render/fields';
import { PlayerControls, type PlayerFacts } from '@/player/PlayerControls';
import { useMedia } from '@/player/useMedia';
import { usePlayerConfig } from '@/player/usePlayerConfig';

/**
 * `/play/:type/:id`: the video player for a title. The surface is `surface.aspect` (16:9) as wide as
 * the window allows; the controls on it are the product's published player layout
 * (`GET /v1/player-config/{product}?dt=`). With no published layout the browser's own player is shown.
 *
 * The delivery API has no stream address yet, so the stream is the title's `previewVideoUrl` when it
 * has one; without it the title's picture stands in and the controls drive an empty player.
 */
export function PlayerScreen() {
  const { id } = useParams<{ type: string; id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fromState = (location.state as { title?: Title } | null)?.title ?? null;
  // Opened from a link or a reload: the title, if a rail has already brought it.
  const fromStore = useAppSelector((s) => {
    for (const e of Object.values(s.pages.items)) {
      const t = e.data?.find((x) => x.id === id);
      if (t) return t;
    }
    return null;
  });
  const title = fromState ?? fromStore;
  const { status, config, source, answer } = usePlayerConfig();
  const [wrapRef, available] = useElementWidth<HTMLDivElement>();
  const viewportH = useViewportHeight();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const media = useMedia(video, title?.durationSeconds ?? null);
  const [ad] = useState(false);

  const [aw, ah] = (config?.surface.aspect ?? '16:9').split(':').map(Number);
  const ratio = aw && ah ? aw / ah : 16 / 9;
  // As wide as there is room for, never taller than the window.
  const W = Math.min(available, viewportH * ratio);
  const H = W / ratio;

  const facts = useMemo<PlayerFacts>(
    () => ({
      introMarkers: false,
      hasNext: false,
      hasEpisodes: false,
      hasAudioTracks: media.audioOptions.length > 1,
      hasSubtitles: media.subtitleOptions.length > 0,
    }),
    [media.audioOptions.length, media.subtitleOptions.length],
  );
  const unavailable = useCallback(
    (what: string) => dispatch(showToast(`"${what}" is not available yet.`)),
    [dispatch],
  );

  const src = title?.previewVideoUrl ?? undefined;
  const poster = imageFor(title, '0-16x9') ?? undefined;

  return (
    <main ref={wrapRef}>
      {status === 'loading' ? (
        <div>Loading…</div>
      ) : (
        <>
          {/* Which player config was used: the address asked and what it answered. */}
          {answer && (
            <div role="note">
              Player config: <code>{answer.url}</code> answered {answer.status || 'nothing'}
              {source === 'server'
                ? ''
                : source === 'sample'
                  ? " (none published): showing the backend's sample layout."
                  : " (none published): the browser's own player."}
              {answer.trackingId && source !== 'server' ? ` tracking_id ${answer.trackingId}` : ''}
            </div>
          )}
          {!src && <div role="note">This title has no stream address in the delivery API yet.</div>}
          <div ref={surfaceRef} style={{ position: 'relative', width: W, height: H, margin: '0 auto' }}>
            <video
              ref={setVideo}
              src={src}
              poster={poster}
              playsInline
              // No published layout: the browser's own controls.
              controls={!config}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: '#000',
              }}
            />
            {config && W > 0 && (
              <PlayerControls
                config={config}
                ad={ad}
                media={media}
                facts={facts}
                title={title}
                width={W}
                height={H}
                surfaceRef={surfaceRef}
                video={video}
                onBack={() => navigate(-1)}
                onUnavailable={unavailable}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
