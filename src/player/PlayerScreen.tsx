import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { showToast } from '@/app/uiSlice';
import type { Title } from '@/lib/api/types';
import { useElementWidth, useViewportHeight } from '@/lib/device/useElementWidth';
import { imageFor } from '@/lib/render/fields';
import { PlayerControls, type PlayerFacts } from '@/player/PlayerControls';
import { demoOn, useDemoMedia } from '@/player/demo';
import { useMedia } from '@/player/useMedia';
import { useTitlePlayback } from '@/player/useTitlePlayback';
import { usePlayerConfig } from '@/player/usePlayerConfig';

/**
 * `/play/:type/:id`: the video player for a title. The controls span the whole window and are the
 * product's published player layout (`GET /v1/player-config/{product}?dt=`); the picture fills the window
 * as `surface.fit` says (`cover`: the whole window, edges cropped; `contain`, or unset: all of it, with
 * bars where the shapes differ). With no published layout the browser's own player is shown.
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
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const toast = useAppSelector((s) => s.ui.toast);
  const say = useCallback((text: string) => dispatch(showToast(text)), [dispatch]);
  // What the title offers (its qualities, audio languages, subtitles, intro, season episodes): the API's.
  const offer = useTitlePlayback(id, video, say);
  const title = offer.title ?? fromState ?? fromStore;
  const { status, config } = usePlayerConfig();
  const [wrapRef, available] = useElementWidth<HTMLDivElement>();
  const viewportH = useViewportHeight();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const own = useMedia(video, title?.durationSeconds ?? null);
  // demo only (`demo.ts`): Paper Kingdoms without playback data of its own is shown with sample data.
  const demo = demoOn(id) && !offer.ready;
  const sample = useDemoMedia(own, demo, say);
  const media = useMemo(() => (offer.ready ? offer.extend(own) : sample), [offer, own, sample]);
  const [ad] = useState(false);

  // The controls span the whole window (their positions are fractions of it); the video keeps its own
  // shape inside (`object-fit: contain`), so a window wider than 16:9 letterboxes the picture only.
  const W = available;
  const H = viewportH;

  const facts = useMemo<PlayerFacts>(
    () => ({
      introMarkers: offer.ready ? offer.facts.introMarkers : demo,
      hasNext: offer.ready ? offer.facts.hasNext : demo,
      hasEpisodes: offer.ready ? offer.facts.hasEpisodes : demo,
      hasAudioTracks: media.audioOptions.length > 1,
      hasSubtitles: media.subtitleOptions.length > 0,
    }),
    [demo, offer.ready, offer.facts, media.audioOptions.length, media.subtitleOptions.length],
  );
  const unavailable = useCallback(
    (what: string) => dispatch(showToast(`"${what}" is not available yet.`)),
    [dispatch],
  );

  const src = offer.ready ? offer.src : (title?.previewVideoUrl ?? undefined);
  const poster = imageFor(title, '0-16x9') ?? undefined;

  return (
    <main
      ref={wrapRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        overflow: 'hidden',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {status === 'loading' ? (
        <div style={{ color: '#fff' }}>Loading…</div>
      ) : (
        <>
          {/* A note over the corner when the title has no video address. */}
          <div style={{ position: 'absolute', top: 4, left: 8, zIndex: 20, fontSize: 12, color: '#9aa0ae' }}>
            {!src && <div role="note">This title has no video address in the delivery API yet.</div>}
          </div>
          {toast && (
            <div
              role="status"
              style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 30,
                padding: '10px 16px',
                borderRadius: 8,
                background: '#1e2330',
                color: '#ffffff',
                fontSize: 14,
              }}
            >
              {toast.text}
            </div>
          )}
          <div ref={surfaceRef} style={{ position: 'relative', width: W, height: H }}>
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
                // The product's choice (`surface.fit`); unset: all of the picture.
                objectFit: config?.surface.fit ?? 'contain',
                background: '#000',
              }}
            >
              {offer.subtitleFiles.map((t) => (
                <track
                  key={t.id}
                  id={t.id}
                  kind="subtitles"
                  srcLang={t.language}
                  label={t.label}
                  src={t.src}
                />
              ))}
            </video>
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
                stageRef={wrapRef}
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
