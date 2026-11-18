import type Hls from 'hls.js';

/**
 * Plays an address in a `<video>`, HLS included. An HLS address (`.m3u8`) is a list of small pieces, not
 * one file. hls.js reads the list, fetches the pieces and feeds them to the `<video>` (Media Source
 * Extensions); a browser without Media Source but with HLS of its own (an older iPhone) plays it itself.
 * An MP4 is set as the `<video>`'s own `src`, as before.
 *
 * hls.js is used even where the browser plays HLS itself (Safari, newer Chrome): only hls.js can put a
 * signed stream's signature on every piece (`signPieces`), and it picks the quality the same way
 * everywhere. It is loaded only when an HLS address needs it, so a page with none does not download it.
 *
 * Returns what undoes it (stops hls.js, frees the `<video>`); `onFail` is called once if the video
 * cannot be played at all (a browser with neither, or a stream that will not load).
 */
export function attachSource(
  video: HTMLVideoElement,
  src: string,
  {
    onFail,
    preview = false,
  }: {
    onFail?: () => void;
    /** A preview: start at the lowest quality and keep little ahead, so it starts fast and costs little. */
    preview?: boolean;
  } = {},
): () => void {
  if (!isHls(src)) return playItself(video, src);

  let hls: Hls | null = null;
  let undo: (() => void) | null = null;
  let cancelled = false;
  void import('hls.js')
    .then(({ default: HlsJs }) => {
      if (cancelled) return;
      if (!HlsJs.isSupported()) {
        if (playsHlsItself(video)) undo = playItself(video, src);
        else onFail?.();
        return;
      }
      const sign = signPieces(src);
      hls = new HlsJs({
        // Never fetch a picture sharper than the `<video>` is drawn.
        capLevelToPlayerSize: true,
        ...(sign ? { xhrSetup: (xhr: XMLHttpRequest, url: string) => xhr.open('GET', sign(url), true) } : {}),
        ...(preview ? { startLevel: 0, maxBufferLength: 10, maxMaxBufferLength: 20 } : {}),
      });
      hls.on(HlsJs.Events.ERROR, (_event, data) => {
        if (!data.fatal) return; // hls.js recovers from the others by itself
        hls?.destroy();
        hls = null;
        onFail?.();
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    })
    .catch(() => {
      if (cancelled) return;
      // hls.js could not be fetched: the browser's own HLS, if it has it.
      if (playsHlsItself(video)) undo = playItself(video, src);
      else onFail?.();
    });

  return () => {
    cancelled = true;
    hls?.destroy();
    hls = null;
    undo?.();
  };
}

/** An HLS address: its path ends in `.m3u8` (a query or fragment after it is fine). */
export function isHls(src: string): boolean {
  return /\.m3u8(?:[?#]|$)/i.test(src);
}

/** The keys of a CloudFront signed address (`backend/app/core/url_signing.py`). */
const SIGNED_KEYS = ['Policy', 'Signature', 'Key-Pair-Id', 'Expires'] as const;

/**
 * A signed stream's playlist carries its signature in its query, and the signature allows the whole
 * folder. The pieces the playlist lists do not carry it, so each request on the same host gets the
 * playlist's signature added (one that already has its own keeps it). Null: the address is not signed.
 */
export function signPieces(src: string): ((url: string) => string) | null {
  let playlist: URL;
  try {
    playlist = new URL(src, window.location.href);
  } catch {
    return null;
  }
  if (!playlist.searchParams.has('Signature') || !playlist.searchParams.has('Key-Pair-Id')) return null;
  const keys = SIGNED_KEYS.filter((k) => playlist.searchParams.has(k));
  return (url: string) => {
    let piece: URL;
    try {
      piece = new URL(url, playlist);
    } catch {
      return url;
    }
    if (piece.origin !== playlist.origin || piece.searchParams.has('Signature')) return url;
    for (const k of keys) piece.searchParams.set(k, playlist.searchParams.get(k)!);
    return piece.toString();
  };
}

function playItself(video: HTMLVideoElement, src: string): () => void {
  video.src = src;
  return () => {
    video.removeAttribute('src');
    video.load();
  };
}

/** Safari (and any browser that says it can) plays HLS in a plain `<video>`. */
function playsHlsItself(video: HTMLVideoElement): boolean {
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}
