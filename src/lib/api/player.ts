/**
 * The player's layout (`GET /v1/player-config/{product}?dt=`), as the client reads it. Reference:
 * `docs/player-config-client/README.md` in the CMS repo. Lengths are in `device.unit`, already scaled
 * for the device; frames are fractions of the player's safe rectangle. Unknown keys are ignored.
 */
import type { Atom, Block, Point } from '@/lib/api/types';

export interface PlayerFrame {
  cx: number;
  cy: number;
  pivot: Point;
  sizing: 'fixed' | 'min' | 'hug' | 'fill' | string;
  w: number | null;
  h: number | null;
  x: number | null;
  y: number | null;
  /** The edges the product fixed: a longer label grows away from them. */
  pinned: string[];
}

/** `this.attr RELATION to.toAttr × multiplier + constant` (constant in the device's unit). */
export interface Tie {
  attr: string;
  relation: string;
  to: string;
  toAttr: string;
  multiplier?: number | null;
  constant?: number | null;
}

export interface PanelData {
  kind: 'options' | 'groups' | 'items' | string;
  title?: string;
  source?: string;
  firstOption?: string;
  groups?: { title: string; source: string; firstOption?: string }[];
}

export interface ControlPanel {
  /** The design in `panels`; absent: the app draws its own panel. */
  component?: string;
  /** Episodes only: the card design in `rows`. */
  row?: string;
  opens: 'drawer' | 'popover' | 'sheet' | 'modal' | string;
  placement: { mode: 'anchored' | 'custom' | string; x?: number; y?: number };
  closeOnSelect: boolean;
  list?: { scope: string; itemWidth: number; fullWidth: boolean; direction: string };
  data?: PanelData;
}

export interface Control {
  /** What the control is: back, title, playPause, rewind, forward, seekBar, elapsed, quality… */
  id: string;
  frame: PlayerFrame;
  ties?: Tie[];
  limits?: { width?: { min?: number; max?: number }; height?: { min?: number; max?: number } };
  /** A capability the app must have: `cast`, `pip`, `fullscreen`. */
  requires?: string | null;
  /** `introMarkers`, `hasNext`, `hasEpisodes`, `hasAudioTracks`, `hasSubtitles`. */
  showWhen?: string | null;
  /** The control's own settings (`seconds`, `label`, `format`…). */
  config?: Record<string, unknown>;
  /** The atom's design, ready to draw (a schema 3 atom); absent: the app's own look. */
  look?: Atom | null;
  panel?: ControlPanel;
}

export interface PanelPlacement {
  edge: 'right' | 'bottom' | 'centre' | 'above-button' | string;
  fullWidth?: boolean;
  maxWidthPct: number | null;
  maxHeightPct: number | null;
  radiusPx: number | null;
  corners: 'none' | 'top' | 'all' | string;
  backdrop: 'dim' | 'none' | string;
  gapPx?: number;
  marginPx?: number;
}

export interface PlayerConfig {
  schemaVersion: number;
  profile: string;
  version: number;
  deviceClass: 'tv' | 'web' | 'tablet' | 'mobile' | string;
  device: { dt: string; unit: string; unitScale: number };
  surface: { aspect: string; design: { w: number; h: number }; safe: { x: number; y: number } };
  /** In reading order; only the controls that are switched on. */
  controls: Control[];
  /** While an ad plays, drawn instead of `controls`. */
  ad?: { controls: Control[] };
  panels?: Record<string, Block>;
  rows?: Record<string, Block>;
  panelContract?: {
    roles: Record<string, string>;
    repeat: { property: string; option: string };
    state: { property: string; selected: string; unselected: string };
    focus: { start: string; back: string; after: string };
    placement: Record<string, PanelPlacement>;
  };
  theme?: { defaultFontFamily: string | null; fonts: { family: string; source: string }[] };
  behaviour: {
    input: 'pointer' | 'touch' | 'remote' | string;
    autoHideSeconds: number;
    initialFocus: string | null;
    focusOrder: string[];
    seekStepSeconds: number;
    /** No touch or focus target smaller than this (device unit). */
    minTarget: number;
  };
}
