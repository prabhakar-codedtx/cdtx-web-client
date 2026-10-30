import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Control, PlayerConfig, PlayerFrame } from '@/lib/api/player';
import type { Atom, Title } from '@/lib/api/types';
import { resolveLayout } from '@/lib/layout/resolve';
import type { Attribute, Box, LayoutRule, Relation } from '@/lib/layout/types';
import { AtomView, type PartCtx } from '@/render/Parts';
import { Panel } from '@/player/Panel';
import { clock, type Media } from '@/player/useMedia';

/**
 * The player's controls, drawn from the player config (`docs/player-config-client/README.md`): every
 * control at its `frame` (fractions of the safe rectangle), its `look` (a schema 3 atom) drawn inside
 * it, its `ties` solved after measuring, its `limits` applied; only the ones whose `requires` the
 * browser has and whose `showWhen` holds now. `behaviour` sets the hide time, the first focus, the
 * focus order, the seek step and the least target size. A control without `look` is the client's own
 * plain element.
 */

/** What this browser can do (`requires`). */
const CAN: Record<string, () => boolean> = {
  fullscreen: () => Boolean(document.fullscreenEnabled),
  pip: () => Boolean((document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled),
  // No cast SDK in this client.
  cast: () => false,
};

/** What holds now (`showWhen`). No intro markers, next episode or episode list reach the client yet. */
export interface PlayerFacts {
  introMarkers: boolean;
  hasNext: boolean;
  hasEpisodes: boolean;
  hasAudioTracks: boolean;
  hasSubtitles: boolean;
}

/** Controls whose words change while playing: drawn with their `look`, the words replaced. */
const LABELS = new Set([
  'title',
  'elapsed',
  'remaining',
  'time',
  'adLabel',
  'adCountdown',
  'skipIntro',
  'nextEpisode',
]);
/** Controls that stay on screen while the others fade out: they are only drawn for a few seconds
 * (Skip intro during the intro, Next episode at the end) and are there to be pressed. */
const STAY = new Set(['skipIntro', 'nextEpisode']);
/** Controls that show something and do nothing when pressed. */
const PASSIVE = new Set(['title', 'elapsed', 'remaining', 'time', 'adLabel', 'adCountdown']);

function frameCss(f: PlayerFrame, W: number, H: number): CSSProperties {
  const css: CSSProperties = { position: 'absolute', left: f.cx * W, top: f.cy * H };
  const tx = -(f.pivot.x ?? 0) * 100;
  const ty = -(f.pivot.y ?? 0) * 100;
  if (tx || ty) css.transform = `translate(${tx}%, ${ty}%)`;
  if (f.w !== null) css[f.sizing === 'min' ? 'minWidth' : 'width'] = f.w * W;
  else css.width = 'max-content';
  if (f.h !== null) css[f.sizing === 'min' ? 'minHeight' : 'height'] = f.h * H;
  return css;
}

function limitsCss(c: Control, k: number): CSSProperties {
  const l = c.limits;
  if (!l) return {};
  const at = (v: number | undefined) => (v === undefined ? undefined : v * k);
  return {
    minWidth: at(l.width?.min),
    maxWidth: at(l.width?.max),
    minHeight: at(l.height?.min),
    maxHeight: at(l.height?.max),
  };
}

function withText(atom: Atom, text: string): Atom {
  return {
    ...atom,
    staticText: atom.type === 'text' ? text : atom.staticText,
    bind: atom.type === 'text' ? null : atom.bind,
    style: {
      ...atom.style,
      layers: atom.style.layers.map((l) => (l.type === 'text' ? { ...l, staticText: text, bind: null } : l)),
    },
  };
}

/** How a control answers the pointer and the keyboard: a lift on hover, a press, and a ring on focus. */
const FEEDBACK_CSS = `
[data-pc] { transition: transform 0.12s ease, filter 0.12s ease; outline: none; }
[data-pc]:hover { filter: brightness(1.15); transform: scale(1.04); }
[data-pc]:active { transform: scale(0.94); }
[data-pc]:focus-visible { box-shadow: 0 0 0 2px rgba(255,255,255,0.95), 0 0 0 5px rgba(234,106,0,0.7); }
`;

/** Play/Pause while playing: the design carries only the play icon, so the pause glyph is drawn here in
 * the same size and colour. */
function withPauseIcon(atom: Atom): Atom {
  return {
    ...atom,
    style: {
      ...atom.style,
      layers: atom.style.layers.map((l) => {
        if (l.type !== 'icon' || !l.icon) return l;
        const paint = l.color ?? '#ffffff';
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${paint}">` +
          '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
        return {
          ...l,
          icon: {
            draw: 'as-is',
            svg: `data:image/svg+xml,${encodeURIComponent(svg)}`,
            vectorDrawable: null,
            png: [],
          },
        };
      }),
    },
  };
}

/** The Volume design while muted: its icon swapped for a crossed-out speaker, in the design's colour. */
function withMutedIcon(atom: Atom): Atom {
  return {
    ...atom,
    style: {
      ...atom.style,
      layers: atom.style.layers.map((l) => {
        if (l.type !== 'icon' || !l.icon) return l;
        const paint = l.color ?? '#ffffff';
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${paint}" ` +
          'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M11 5 6 9H2v6h4l5 4V5z"/><line x1="22" y1="9" x2="16" y2="15"/>' +
          '<line x1="16" y1="9" x2="22" y2="15"/></svg>';
        return {
          ...l,
          icon: {
            draw: 'as-is',
            svg: `data:image/svg+xml,${encodeURIComponent(svg)}`,
            vectorDrawable: null,
            png: [],
          },
        };
      }),
    },
  };
}

/** The volume slider beside a designed Volume button: hidden until the pointer or focus is on it. */
const VOLUME_CSS =
  '.cdtx-volume{position:relative;display:flex;width:100%;height:100%}' +
  '.cdtx-volume-slider{position:absolute;left:100%;top:50%;transform:translateY(-50%);margin:0 0 0 4px;' +
  'width:0;opacity:0;height:4px;accent-color:#fff;cursor:pointer;transition:width .2s,opacity .2s}' +
  '.cdtx-volume:hover .cdtx-volume-slider,.cdtx-volume:focus-within .cdtx-volume-slider{width:88px;opacity:1}';

/** The seek bar's look with its progress at `percent` (0-100): the slider layer draws the track and fill. */
function withProgress(atom: Atom, percent: number): Atom {
  return {
    ...atom,
    style: {
      ...atom.style,
      layers: atom.style.layers.map((l) =>
        l.type === 'slider' && l.slider ? { ...l, slider: { ...l.slider, value: percent } } : l,
      ),
    },
  };
}

export function PlayerControls({
  config,
  ad,
  media,
  facts,
  title,
  width: W,
  height: H,
  surfaceRef,
  stageRef,
  video,
  onBack,
  onUnavailable,
}: {
  config: PlayerConfig;
  /** An ad is playing: `ad.controls` are drawn instead of `controls`. */
  ad: boolean;
  media: Media;
  facts: PlayerFacts;
  title: Title | null;
  width: number;
  height: number;
  surfaceRef: React.RefObject<HTMLDivElement>;
  /** The window-filling stage the player sits on: what goes full screen. */
  stageRef?: React.RefObject<HTMLElement>;
  video: HTMLVideoElement | null;
  onBack: () => void;
  onUnavailable: (what: string) => void;
}) {
  const b = config.behaviour;
  // Lengths are for `surface.design`; a player of another size scales them (guide 11).
  // Sizes scale by what the 16:9 design would fit in (the smaller of the two), while positions spread over
  // the whole window: a window wider than 16:9 gets wider spacing, not bigger buttons.
  const { w: dw, h: dh } = config.surface.design;
  const k = dw && dh ? Math.min(W / dw, H / dh) : dw ? W / dw : 1;
  const safeX = config.surface.safe.x * k;
  const safeY = config.surface.safe.y * k;
  const SW = Math.max(0, W - 2 * safeX);
  const SH = Math.max(0, H - 2 * safeY);
  const layerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  // Where the opening button and the controls layer were when the panel opened (a popover sits above it).
  const [rects, setRects] = useState<{ anchor: DOMRect | null; surface: DOMRect | null }>({
    anchor: null,
    surface: null,
  });
  const [idle, setIdle] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);

  // Drawn only when the browser has what it `requires` and its `showWhen` holds now.
  const all = ad && config.ad ? config.ad.controls : config.controls;
  // The whole stage goes full screen (the black around the 16:9 player too), not the player's box: that
  // would keep its pixel size.
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void (stageRef?.current ?? surfaceRef.current)?.requestFullscreen();
  };
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (document.fullscreenEnabled) toggleFullscreen();
    };
    document.addEventListener('fullscreenchange', change);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The product's player may not have a Fullscreen control: the client then has its own button.
  const ownFullscreen = document.fullscreenEnabled && !config.controls.some((c) => c.id === 'fullscreen');

  const shown = useMemo(() => {
    const ok = all.filter(
      (c) =>
        (!c.requires || (CAN[c.requires]?.() ?? false)) &&
        (!c.showWhen || Boolean(facts[c.showWhen as keyof PlayerFacts])),
    );
    // The page order is the focus order, so Tab walks `behaviour.focusOrder`; without one (the
    // server no longer sends it) the controls keep the order they came in.
    const order = b.focusOrder ?? [];
    const at = (c: Control) => {
      const i = order.indexOf(c.id);
      return i < 0 ? order.length + ok.indexOf(c) : i;
    };
    return [...ok].sort((x, y) => at(x) - at(y));
  }, [all, facts, b.focusOrder]);

  // ---- ties: measure each control, then solve (a tie to a control not drawn is left out) --------
  const rules = useMemo<LayoutRule[]>(() => {
    const ids = new Set(shown.map((c) => c.id));
    return shown.flatMap((c) =>
      (c.ties ?? [])
        .filter((t) => ids.has(t.to))
        .map((t, i) => ({
          id: `${c.id}-${i}`,
          item: c.id,
          attr: t.attr as Attribute,
          relation: t.relation as Relation,
          target: t.to,
          targetAttr: t.toAttr as Attribute,
          multiplier: t.multiplier ?? undefined,
          constant: (t.constant ?? 0) * k,
        })),
    );
  }, [shown, k]);
  const [solved, setSolved] = useState<{
    boxes: Record<string, Box>;
    naturals: Record<string, { w: number; h: number }>;
  } | null>(null);
  const key = `${W}|${H}|${shown.map((c) => c.id).join(',')}|${title?.id ?? ''}|${ad}`;
  const lastKey = useRef(key);
  useLayoutEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      setSolved(null);
      return;
    }
    if (rules.length === 0 || solved !== null || !layerRef.current) return;
    const naturals: Record<string, { w: number; h: number }> = {};
    const items = shown.flatMap((c) => {
      const node = layerRef.current!.querySelector<HTMLElement>(`[data-control="${c.id}"]`);
      if (!node) return [];
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      naturals[c.id] = { w, h };
      return [
        {
          id: c.id,
          width: w,
          height: h,
          x: c.frame.cx * SW - (c.frame.pivot.x ?? 0) * w,
          y: c.frame.cy * SH - (c.frame.pivot.y ?? 0) * h,
        },
      ];
    });
    setSolved({ boxes: resolveLayout({ parent: { width: SW, height: SH }, items, rules }).boxes, naturals });
  });

  // ---- behaviour: hide after `autoHideSeconds` without input while playing; the first focus --------
  useEffect(() => {
    if (!media.playing || open) return;
    let t = window.setTimeout(() => setIdle(true), b.autoHideSeconds * 1000);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), b.autoHideSeconds * 1000);
    };
    const surface = surfaceRef.current;
    const events = ['mousemove', 'pointerdown', 'keydown', 'touchstart'] as const;
    for (const e of events) surface?.addEventListener(e, wake);
    return () => {
      window.clearTimeout(t);
      for (const e of events) surface?.removeEventListener(e, wake);
    };
  }, [media.playing, open, b.autoHideSeconds, surfaceRef]);

  // ---- behaviour: a click on the picture plays or pauses (`tapToToggle`) ----------------------------
  // Only a click on the picture itself, or on the controls layer between the controls: never one on a
  // control or inside an open panel.
  const tapToToggle = b.tapToToggle ?? b.input === 'pointer';
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!tapToToggle || !surface || !video) return;
    const click = (e: MouseEvent) => {
      if (open || e.button !== 0) return;
      if (e.target !== video && e.target !== layerRef.current) return;
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
    };
    surface.addEventListener('click', click);
    return () => surface.removeEventListener('click', click);
  }, [tapToToggle, open, video, surfaceRef]);

  useEffect(() => {
    if (!b.initialFocus || b.input === 'pointer' || b.input === 'touch') return;
    layerRef.current
      ?.querySelector<HTMLElement>(
        `[data-control="${b.initialFocus}"] [tabindex], [data-control="${b.initialFocus}"] button, [data-control="${b.initialFocus}"] input`,
      )
      ?.focus();
  }, [b.initialFocus, b.input, config]);

  /** A remote moves along `focusOrder` with the arrows (the seek bar keeps Left / Right for seeking). */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (b.input !== 'remote' || open) return;
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!dir) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    const focusables = Array.from(layerRef.current?.querySelectorAll<HTMLElement>('[data-focus]') ?? []);
    const i = focusables.indexOf(target);
    const next = focusables[(i + dir + focusables.length) % focusables.length];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  // ---- what each control does -----------------------------------------------------------------------
  const press = (c: Control, el: HTMLElement) => {
    if (c.panel || c.id === 'speed' || c.id === 'settings') {
      lastFocus.current = el;
      setRects({
        anchor: el.getBoundingClientRect(),
        surface: layerRef.current?.getBoundingClientRect() ?? null,
      });
      setOpen(c.id);
      return;
    }
    const secs = typeof c.config?.seconds === 'number' ? (c.config.seconds as number) : b.seekStepSeconds;
    switch (c.id) {
      case 'back':
        onBack();
        return;
      case 'playPause':
        media.toggle();
        return;
      case 'rewind':
        media.seekBy(-secs);
        return;
      case 'forward':
        media.seekBy(secs);
        return;
      case 'fullscreen':
        toggleFullscreen();
        return;
      case 'pip': {
        const d = document as Document & {
          pictureInPictureElement?: Element;
          exitPictureInPicture?: () => Promise<void>;
        };
        const v = video as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
        if (d.pictureInPictureElement) void d.exitPictureInPicture?.();
        else void v?.requestPictureInPicture?.().catch(() => onUnavailable('Picture in picture'));
        return;
      }
      case 'volume':
        media.toggleMute();
        return;
      case 'volumeUp':
      case 'volumeDown': {
        const step = (typeof c.config?.step === 'number' ? c.config.step : (b.volumeStepPercent ?? 10)) / 100;
        // Read from the element, not the last render: two quick presses make two steps.
        const muted = video?.muted ?? media.muted;
        const volume = video?.volume ?? media.volume;
        // Turning it up while muted unmutes, from silence; turning it down while muted stays muted.
        if (c.id === 'volumeUp') {
          if (muted) media.toggleMute();
          media.setVolume((muted ? 0 : volume) + step);
        } else if (!muted) media.setVolume(volume - step);
        return;
      }
      default:
        // demo only: what Skip intro and Next episode do (`demo.ts`).
        if (media.demo?.[c.id]) media.demo[c.id]!();
        else onUnavailable(c.id);
    }
  };

  /** The words a label control shows now. */
  const words = (c: Control): string => {
    switch (c.id) {
      case 'title':
        return [title?.title, c.config?.showSubtitle ? title?.episodeLabel : null]
          .filter(Boolean)
          .join(' · ');
      case 'elapsed':
        return clock(media.time);
      case 'remaining':
        return `-${clock(media.duration - media.time)}`;
      case 'time': {
        const mode = c.config?.mode ?? 'remaining';
        if (mode === 'elapsed') return clock(media.time);
        if (mode === 'both') return `${clock(media.time)} / ${clock(media.duration)}`;
        return `-${clock(media.duration - media.time)}`;
      }
      case 'adLabel':
        return typeof c.config?.text === 'string' ? c.config.text : 'Ad';
      case 'adCountdown':
        return clock(media.duration - media.time, c.config?.format as string | undefined);
      case 'skipIntro':
        return typeof c.config?.label === 'string' ? c.config.label : 'Skip Intro';
      case 'nextEpisode': {
        // The countdown to the next episode: it starts by itself when this one ends.
        const left = Math.max(0, Math.ceil(media.duration - media.time));
        return `Next episode in ${left}s`;
      }
      default:
        return '';
    }
  };

  /** The client's own plain element for a control that has no `look`. */
  const builtIn = (c: Control): ReactNode => {
    switch (c.id) {
      case 'playPause':
        return media.playing ? 'Pause' : 'Play';
      case 'rewind':
        return `-${typeof c.config?.seconds === 'number' ? c.config.seconds : b.seekStepSeconds}s`;
      case 'forward':
        return `+${typeof c.config?.seconds === 'number' ? c.config.seconds : b.seekStepSeconds}s`;
      case 'back':
        return 'Back';
      case 'nextEpisode':
        return words(c);
      case 'episodes':
        return 'Episodes';
      case 'quality':
        return 'Quality';
      case 'audio':
        return 'Audio';
      case 'subtitles':
        return 'Subtitles';
      case 'audioSubtitles':
        return 'Audio and subtitles';
      case 'speed':
        return `${media.rate}x`;
      case 'settings':
        return 'Settings';
      case 'fullscreen':
        return 'Fullscreen';
      case 'pip':
        return 'Picture in picture';
      case 'cast':
        return 'Cast';
      case 'reportIssue':
        return 'Report an issue';
      case 'volume':
        return media.muted ? 'Unmute' : 'Mute';
      case 'volumeUp':
        return 'Volume up';
      case 'volumeDown':
        return 'Volume down';
      default:
        return words(c) || c.id;
    }
  };

  const visible = !idle || !media.playing || Boolean(open);
  // The controls fade out when idle (and are out of the tab order once gone); `STAY` ones do not.
  const fade: CSSProperties = {
    visibility: visible ? 'visible' : 'hidden',
    opacity: visible ? 1 : 0,
    transition: visible ? 'opacity 0.15s ease' : 'opacity 0.3s ease, visibility 0s linear 0.3s',
  };
  const ctx: PartCtx = { title, fit: k, cardW: W, aspect: null };
  const target = b.minTarget * k;

  const content = (c: Control): ReactNode => {
    if (c.id === 'seekBar') {
      // The design's slider (track and progress colours) is what is seen; the range input on top of it
      // is invisible and takes the pointer, the keyboard and the remote.
      const drawn = c.look?.style.layers.some((l) => l.type === 'slider' && l.slider);
      const percent = media.duration ? (Math.min(media.time, media.duration) / media.duration) * 100 : 0;
      return (
        <span style={{ position: 'relative', display: 'block', width: '100%', height: '100%' }}>
          {drawn && c.look && (
            <AtomView
              atom={withProgress(c.look, percent)}
              ctx={ctx}
              inFrame
              style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
            />
          )}
          <input
            type="range"
            data-focus
            aria-label="Seek"
            min={0}
            max={media.duration || 0}
            step={b.seekStepSeconds}
            value={Math.min(media.time, media.duration || 0)}
            onChange={(e) => media.seekTo(Number(e.target.value))}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              margin: 0,
              ...(drawn ? { opacity: 0, cursor: 'pointer' } : {}),
            }}
          />
        </span>
      );
    }
    // No design for Volume: the client's own Mute button and slider. With one, the design's icon is the
    // mute button and the slider opens beside it on hover (`withVolumeSlider`).
    if (c.id === 'volume' && c.config?.showSlider !== false && !c.look) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button type="button" data-focus onClick={(e) => press(c, e.currentTarget)}>
            {media.muted ? 'Unmute' : 'Mute'}
          </button>
          <input
            type="range"
            data-focus
            aria-label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={media.muted ? 0 : media.volume}
            onChange={(e) => media.setVolume(Number(e.target.value))}
          />
        </span>
      );
    }
    let look = c.look ? (LABELS.has(c.id) ? withText(c.look, words(c)) : c.look) : null;
    if (look && c.id === 'playPause' && media.playing) look = withPauseIcon(look);
    if (look && c.id === 'volume' && media.muted) look = withMutedIcon(look);
    const face = look ? (
      <AtomView atom={look} ctx={ctx} inFrame style={{ width: '100%', height: '100%' }} />
    ) : (
      builtIn(c)
    );
    if (PASSIVE.has(c.id))
      return (
        <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center' }}>{face}</span>
      );
    const sized = c.frame.w !== null || c.frame.h !== null;
    // A `min` box is at least its size and grows with its content, so the control around it has only a
    // minimum height: a face of `height: 100%` would not fill it (a 63 x 63 button drawn 63 x 39).
    // It fills it by stretching instead.
    const fill: CSSProperties =
      c.frame.sizing === 'min'
        ? { flex: '1 1 auto', alignSelf: 'stretch' }
        : { width: sized ? '100%' : undefined, height: sized ? '100%' : undefined };
    const common = {
      'data-focus': true,
      'aria-label': c.look?.staticText ?? (typeof builtIn(c) === 'string' ? (builtIn(c) as string) : c.id),
      'aria-haspopup': c.panel ? ('dialog' as const) : undefined,
      onClick: (e: React.MouseEvent<HTMLElement>) => press(c, e.currentTarget),
    };
    // Volume drawn by its design: the icon mutes, and the level slider opens beside it on hover.
    const withVolumeSlider = (button: React.ReactElement) => (
      <span className="cdtx-volume">
        {button}
        <input
          type="range"
          className="cdtx-volume-slider"
          data-focus
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={media.muted ? 0 : media.volume}
          onChange={(e) => media.setVolume(Number(e.target.value))}
        />
        <style>{VOLUME_CSS}</style>
      </span>
    );
    // A look is drawn as it is (a plain box, no browser button look); the client's own is a button.
    // Either way the hit zone is at least `behaviour.minTarget`.
    if (look) {
      const drawn = (
        <div
          {...common}
          data-pc=""
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              press(c, e.currentTarget);
            }
          }}
          style={{
            display: 'flex',
            ...fill,
            minWidth: target,
            minHeight: target,
            cursor: 'pointer',
            // The focus ring and the press feedback follow the design's own corners.
            borderRadius: look.style.box.cornerRadius ? look.style.box.cornerRadius * k : undefined,
          }}
        >
          {face}
        </div>
      );
      return c.id === 'volume' && c.config?.showSlider !== false ? withVolumeSlider(drawn) : drawn;
    }
    return (
      <button
        type="button"
        {...common}
        style={{
          ...fill,
          minWidth: target,
          minHeight: target,
        }}
      >
        {face}
      </button>
    );
  };

  const place = (c: Control): CSSProperties => {
    const css: CSSProperties = { ...frameCss(c.frame, SW, SH), ...limitsCss(c, k), display: 'flex' };
    const box = solved?.boxes[c.id];
    if (!box) return css;
    const nat = solved?.naturals[c.id];
    const out: CSSProperties = { ...css, left: box.x, top: box.y, transform: undefined };
    if (nat && Math.abs(box.width - nat.w) > 0.5) out.width = box.width;
    if (nat && Math.abs(box.height - nat.h) > 0.5) out.height = box.height;
    return out;
  };

  // A panel opened from Settings may belong to no control of its own: it opens as a drawer.
  const opened: Control | undefined = open
    ? (shown.find((c) => c.id === open) ??
      config.controls.find((c) => c.id === open) ?? {
        id: open,
        frame: config.controls[0]!.frame,
        panel: { opens: 'drawer', placement: { mode: 'anchored' }, closeOnSelect: true },
      })
    : undefined;
  const close = () => {
    setOpen(null);
    // Focus returns to the button that opened it (`panelContract.focus.after`).
    lastFocus.current?.focus();
  };

  return (
    <div
      ref={layerRef}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        left: safeX,
        top: safeY,
        width: SW,
        height: SH,
        // Faded out, the layer lets the pointer through to the picture (a `STAY` control takes it back).
        pointerEvents: visible ? undefined : 'none',
      }}
    >
      <style>{FEEDBACK_CSS}</style>
      {shown.map((c) => (
        <div
          key={c.id}
          data-control={c.id}
          style={{ ...place(c), ...(STAY.has(c.id) ? { pointerEvents: 'auto' } : fade) }}
        >
          {content(c)}
        </div>
      ))}
      {ownFullscreen && (
        <button
          type="button"
          data-focus
          data-pc=""
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          onClick={toggleFullscreen}
          style={{
            ...fade,
            position: 'absolute',
            top: 12 * k,
            right: 12 * k,
            width: Math.max(36 * k, b.minTarget * k),
            height: Math.max(36 * k, b.minTarget * k),
            padding: 0,
            border: 0,
            borderRadius: 8 * k,
            background: '#1e2330',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg
            width={18 * k}
            height={18 * k}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {fullscreen ? (
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            ) : (
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            )}
          </svg>
        </button>
      )}
      {opened && (
        <Panel
          control={opened}
          config={config}
          media={media}
          k={k}
          anchor={rects.anchor}
          surface={rects.surface}
          onClose={close}
          openOther={(id) => setOpen(id)}
        />
      )}
    </div>
  );
}
