import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { showToast } from '@/app/uiSlice';
import type { Title } from '@/lib/api/types';
import { useElementWidth, useViewportHeight } from '@/lib/device/useElementWidth';
import { imageFor } from '@/lib/render/fields';
import { PlayerControls, type PlayerFacts } from '@/player/PlayerControls';
import { demoOn, useDemoMedia } from '@/player/demo';
import { attachSource } from '@/player/hls';
import { useMedia } from '@/player/useMedia';
import { useAds } from '@/player/useAds';
import { useTitlePlayback } from '@/player/useTitlePlayback';
import { usePlayerConfig } from '@/player/usePlayerConfig';
import { useShowNav } from '@/screens/navVisibility';

/**
 * `/play/:type/:id`: the video player for a title. The controls span the whole window and are the
 * product's published player layout (`GET /v1/player-config/{product}?dt=`); the picture fills the window
 * as `surface.fit` says (`cover`: the whole window, edges cropped; `contain`, or unset: all of it, with
 * bars where the shapes differ). With no published layout the browser's own player is shown.
 *
 * The stream is the title's playback address (its quality or audio language), else its `previewVideoUrl`;
 * without either the title's picture stands in and the controls drive an empty player. MP4 or HLS
 * (`.m3u8`, through hls.js: `attachSource`).
 */
/** Next episode is offered in the last this-many seconds; when the video ends the next one starts. */
const UP_NEXT_SECONDS = 20;

export function PlayerScreen() {
  const { id } = useParams<{ type: string; id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // The player fills the screen: never the tab bar over it.
  useShowNav(false);
  const arrived = location.state as { title?: Title | null; autoplay?: boolean } | null;
  const fromState = arrived?.title ?? null;
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
  const [adVideo, setAdVideo] = useState<HTMLVideoElement | null>(null);
  const adMedia = useMedia(adVideo, null);

  // The controls span the whole window (their positions are fractions of it); the video keeps its own
  // shape inside (`object-fit: contain`), so a window wider than 16:9 letterboxes the picture only.
  const W = available;
  const H = viewportH;

  // Skip intro: only while the video is inside the intro (pressed, it jumps to its end and goes).
  // Next episode: only in the last UP_NEXT_SECONDS, by the video's own length (not the title's
  // `durationSeconds`, which may not be the stream's).
  const { intro, next } = offer;
  const inIntro = intro !== null && own.time >= intro.start && own.time < intro.end;
  const length = video && Number.isFinite(video.duration) ? video.duration : 0;
  const upNext = next !== null && length > 0 && length - own.time <= UP_NEXT_SECONDS;
  const facts = useMemo<PlayerFacts>(
    () => ({
      introMarkers: offer.ready ? inIntro : demo,
      hasNext: offer.ready ? upNext : demo,
      hasEpisodes: offer.ready ? offer.facts.hasEpisodes : demo,
      hasAudioTracks: media.audioOptions.length > 1,
      hasSubtitles: media.subtitleOptions.length > 0,
    }),
    [
      demo,
      offer.ready,
      inIntro,
      upNext,
      offer.facts,
      media.audioOptions.length,
      media.subtitleOptions.length,
    ],
  );
  const unavailable = useCallback(
    (what: string) => dispatch(showToast(`"${what}" is not available yet.`)),
    [dispatch],
  );

  // Development only (`npm run dev`): `?video=<address>` plays that file for a title with no stream of its own,
  // so the player and its ads can be tried. A production build has no such override.
  const trial = import.meta.env.DEV ? new URLSearchParams(location.search).get('video') : null;
  const src = trial ?? (offer.ready ? offer.src : (title?.previewVideoUrl ?? undefined));
  const poster = imageFor(title, '0-16x9') ?? undefined;
  // The stream into the `<video>`: an MP4 as it is, an HLS stream (`.m3u8`) through hls.js, with a
  // signed stream's signature on every piece. A new quality or language swaps it; where it was carries
  // on (`useTitlePlayback`, on the new stream's `loadedmetadata`).
  useEffect(() => {
    if (!video || !src) return;
    return attachSource(video, src, { onFail: () => say('This video cannot be played.') });
  }, [video, src, say]);
  // The title's ad breaks (pre-roll, mid-rolls, post-roll): an ad plays in its own video over this one.
  const ads = useAds(id, video, Boolean(src));
  const ad = ads.ad;

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
              // A new element for every title: the next episode starts from its own beginning (and
              // `autoPlay` applies) even when it has the same stream address as the one that ended.
              key={id}
              ref={setVideo}
              poster={poster}
              // Opened by Next episode (pressed, or the last one ended): it plays straight away.
              autoPlay={Boolean(arrived?.autoplay)}
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
            {/* Waiting for the video's data: a ring round the centre, so a pressed Play is never a
                frozen 0:00 with no sign of life. Under the controls: the Play button stays on top. */}
            {own.buffering && (
              <div
                role="status"
                aria-label="Loading video"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 132,
                    height: 132,
                    borderRadius: '50%',
                    border: '4px solid rgba(255, 255, 255, 0.2)',
                    borderTopColor: '#ffffff',
                    animation: 'cdtx-spin 0.9s linear infinite',
                  }}
                />
                <style>{'@keyframes cdtx-spin { to { transform: rotate(360deg); } }'}</style>
              </div>
            )}
            {own.failed && (
              <div
                role="alert"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '62%',
                  transform: 'translateX(-50%)',
                  zIndex: 25,
                  maxWidth: '80%',
                  padding: '10px 16px',
                  borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.75)',
                  color: '#ffffff',
                  fontSize: 14,
                  textAlign: 'center',
                }}
              >
                {own.failed}
              </div>
            )}
            {ad && (
              <video
                // One element per ad: it starts from its own beginning.
                key={ad.src}
                ref={(el) => {
                  setAdVideo(el);
                  // The title's volume carries over; a browser that will not start it with sound starts it muted.
                  if (el && video && el.dataset.started !== '1') {
                    el.dataset.started = '1';
                    el.volume = video.volume;
                    el.muted = video.muted;
                    void el.play().catch(() => {
                      el.muted = true;
                      void el.play().catch(() => ads.finish('error'));
                    });
                  }
                }}
                src={ad.src}
                playsInline
                onTimeUpdate={(e) => ad.onTime(e.currentTarget.currentTime, e.currentTarget.duration)}
                onVolumeChange={(e) => ad.onMute(e.currentTarget.muted)}
                onEnded={() => ads.finish('complete')}
                onError={() => ads.finish('error')}
                onClick={ad.clickThrough ? ad.onClick : undefined}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#000',
                  cursor: ad.clickThrough ? 'pointer' : undefined,
                }}
              />
            )}
            {ad && ad.skipAfter !== null && (
              <button
                type="button"
                disabled={adMedia.time < ad.skipAfter}
                onClick={() => ads.finish('skip')}
                style={{
                  position: 'absolute',
                  right: 32,
                  bottom: 120,
                  zIndex: 25,
                  padding: '10px 18px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.6)',
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  fontSize: 14,
                  cursor: adMedia.time < ad.skipAfter ? 'default' : 'pointer',
                }}
              >
                {adMedia.time < ad.skipAfter
                  ? `Skip ad in ${Math.ceil(ad.skipAfter - adMedia.time)}s`
                  : 'Skip ad'}
              </button>
            )}
            {config && W > 0 && (
              <PlayerControls
                config={config}
                ad={Boolean(ad)}
                adBreaks={ads.breaks}
                media={ad ? adMedia : media}
                facts={facts}
                title={title}
                width={W}
                height={H}
                surfaceRef={surfaceRef}
                stageRef={wrapRef}
                video={ad ? adVideo : video}
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
