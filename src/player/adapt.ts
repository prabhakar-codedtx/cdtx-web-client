/**
 * The server's player document is schema 4 (`docs/player-config-client/README.md` in the CMS repo): a
 * control's `frame` is an `anchor` and a `width`, its `look` is one flat object, and the fonts and panel
 * rules sit at the top. The player draws schema 3's shape (`PlayerConfig` in `lib/api/player.ts`), so a
 * schema 4 document is read into it here, once, when it arrives. A schema 3 document is returned as it is.
 *
 * `rows` (the Episodes card) is carried over as a card block. Not carried over: `panels` (their atoms are
 * flat looks with a `panel.role`, which the panel drawing here does not read yet), so a panel is drawn as
 * a plain list.
 */
import type {
  Atom,
  Block,
  Fill,
  Frame,
  IconFiles,
  Layer,
  Point,
  Shadow,
  Sides,
  Stroke,
  TextStyle,
} from '@/lib/api/types';
import type { Control, ControlPanel, PanelPlacement, PlayerConfig, PlayerFrame } from '@/lib/api/player';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

function fill(background: unknown): Fill | null {
  if (typeof background === 'string') {
    return {
      type: 'color',
      color: background,
      gradient: null,
      image: null,
      scrim: null,
      fallbackColor: null,
    };
  }
  if (background && typeof background === 'object') {
    const b = background as Json;
    if (b.gradient) {
      return {
        type: 'gradient',
        color: null,
        gradient: {
          angle: num(b.gradient.angle),
          stops: (b.gradient.stops ?? []).map((s: Json) => ({
            color: str(s.color),
            opacity: num(s.opacity),
            at: num(s.at),
          })),
        },
        image: null,
        scrim: null,
        fallbackColor: null,
      };
    }
    if (b.image) {
      const i = b.image as Json;
      return {
        type: 'image',
        color: null,
        gradient: null,
        image: {
          source: str(i.source),
          url: str(i.url),
          field: str(i.field),
          fit: str(i.fit),
          alignX: str(i.alignX),
          alignY: str(i.alignY),
        },
        scrim: num(i.scrim),
        fallbackColor: str(i.fallbackColor),
      };
    }
  }
  return null;
}

function border(b: unknown): Stroke | null {
  if (!b || typeof b !== 'object') return null;
  const o = b as Json;
  return { width: num(o.width), color: str(o.color), sides: Array.isArray(o.sides) ? o.sides : [] };
}

function sides(p: unknown): Sides {
  const o = (p ?? {}) as Json;
  return { top: num(o.top), right: num(o.right), bottom: num(o.bottom), left: num(o.left) } as Sides;
}

/** A schema 4 icon layer's files, as schema 3 gives them. `tint`: the file is a shape painted `color`. */
function iconFiles(l: Json, prefix = ''): IconFiles | null {
  const png = l[`${prefix}png`];
  const svg = str(l[`${prefix}svg`]);
  const vector = str(l[`${prefix}vectorDrawable`]);
  if (!svg && !vector && !(Array.isArray(png) && png.length)) return null;
  return { draw: l.tint ? 'tint' : 'as-is', svg, vectorDrawable: vector, png: Array.isArray(png) ? png : [] };
}

function layer(l: Json, look: Json): Layer {
  const base = {
    side: str(l.side),
    bind: null as string | null,
    staticText: null as string | null,
    color: str(l.color),
    size: num(l.size),
    emoji: str(l.emoji),
    icon: null as IconFiles | null,
    text: null as TextStyle | null,
    slider: null as Layer['slider'],
    focusColor: str(l.focusColor),
    focusIcon: null as IconFiles | null,
  };
  if (l.type === 'icon') {
    return {
      type: 'icon',
      ...base,
      icon: iconFiles(l),
      focusIcon: l.focusIcon ? iconFiles(l.focusIcon) : null,
    };
  }
  if (l.type === 'text') {
    return {
      type: 'text',
      ...base,
      bind: str(l.bind),
      staticText: str(l.text),
      size: null,
      text: {
        fontFamily: str(l.font),
        fontSize: num(l.size),
        fontWeight: num(l.weight),
        lineHeight: num(l.lineHeight),
        letterSpacing: num(l.letterSpacing),
        color: str(l.color),
        align: str(l.align),
        textCase: str(l.case),
        maxLines: num(l.maxLines),
        shadows: (Array.isArray(l.shadows) ? l.shadows : []) as Shadow[],
      },
    };
  }
  if (l.type === 'slider') {
    return {
      type: 'slider',
      ...base,
      color: null,
      size: null,
      slider: {
        value: num(l.value),
        trackColor: str(l.trackColor),
        progressColor: str(l.progressColor),
        height: num(l.height),
        minWidth: num(l.minWidth),
        cornerRadius: num(l.cornerRadius),
      },
    };
  }
  void look;
  return { type: str(l.type), ...base };
}

/** A schema 4 `look` (flat) as the schema 3 atom node `AtomView` draws. */
function atom(id: string, look: Json): Atom {
  return {
    id,
    type: 'box',
    atomId: null,
    builtIn: null,
    slot: null,
    zIndex: null,
    frame: null,
    scale: 1,
    action: null,
    bind: null,
    staticText: null,
    showWhen: null,
    style: {
      layout: {
        // An absent key is its default (guide section 8): a row, from the start, centred across.
        direction: str(look.direction) ?? 'row',
        justify: str(look.justify) ?? 'start',
        align: str(look.align) ?? 'middle',
        gap: num(look.gap),
        padding: sides(look.padding),
        width: num(look.width),
        height: num(look.height),
        minWidth: num(look.minWidth),
        minHeight: num(look.minHeight),
      },
      box: {
        background: fill(look.background),
        border: border(look.border),
        cornerRadius: num(look.cornerRadius),
        opacity: num(look.opacity) ?? 1,
      },
      text: null,
      meta: null,
      image: null,
      layers: (look.layers ?? []).map((l: Json) => layer(l, look)),
    },
    relative: null,
    focus: look.focus
      ? {
          scale: num(look.focus.scale),
          background: fill(look.focus.background),
          color: str(look.focus.color),
          border: border(look.focus.border),
        }
      : null,
    role: null,
    showLogoWhenAvailable: false,
    titleSlot: null,
  };
}

function frame(f: Json): PlayerFrame {
  const pivot = (f.pivot ?? { x: 0, y: 0 }) as Point;
  return {
    cx: num(f.anchor?.x) ?? 0,
    cy: num(f.anchor?.y) ?? 0,
    pivot,
    sizing: str(f.sizing) ?? 'hug',
    w: num(f.width),
    h: num(f.height),
    x: null,
    y: null,
    pinned: Array.isArray(f.pinned) ? f.pinned : [],
  };
}

/**
 * An Episodes card (`rows[id]`, schema 4: flat atoms with a `frame` and a `look`) as the schema 3 block
 * `CardView` draws: its picture (the episode's own, by `imageAspect`), shade, corners, and atoms placed by
 * their frame (the play icon, the duration).
 */
function rowBlock(id: string, r: Json): Block {
  const width = num(r.width);
  const radius = typeof r.cornerRadius === 'number' && width ? r.cornerRadius / width : null;
  const none = { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
  return {
    id,
    card: {
      width,
      height: num(r.height),
      shape: 'rectangle',
      shapePolygon: [],
      display: 'card',
      stretch: null,
      imageAspect: str(r.imageAspect),
      background: fill(r.background),
      insetImage: null,
      shade: (r.shade ?? []).map((g: Json) => ({
        angle: num(g.angle),
        stops: (g.stops ?? []).map((st: Json) => ({
          color: str(st.color),
          opacity: num(st.opacity),
          at: num(st.at),
        })),
      })),
      border: border(r.border),
      cornerRadiusFrac: none,
      shadows: [],
      focus: { scale: null, border: null, glow: null, durationMs: null },
      contentFit: { minScale: null, maxScale: null },
      stack: [],
    } as Block['card'],
    atoms: (r.atoms ?? []).map((a: Json) => {
      const f = (a.frame ?? {}) as Json;
      const placed: Frame = {
        cx: num(f.anchor?.x),
        cy: num(f.anchor?.y),
        pivot: (f.pivot ?? { x: 0.5, y: 0.5 }) as Point,
        sizing: str(f.sizing) ?? 'hug',
        w: num(f.width),
        h: num(f.height),
        maxW: num(f.maxWidth),
        pinned: Array.isArray(f.pinned) ? f.pinned : [],
      };
      return {
        ...atom(a.id, a.look ?? {}),
        slot: str(a.slot),
        zIndex: num(a.zIndex),
        action: str(a.action),
        frame: placed,
      };
    }),
    components: [],
    layoutRules: (r.layoutRules ?? []).map((l: Json) => ({
      id: str(l.id),
      item: str(l.item),
      attr: str(l.attr),
      relation: str(l.relation),
      target: str(l.target),
      targetAttr: str(l.targetAttr),
      multiplier: num(l.multiplier),
      constant: num(l.constant),
    })),
    rank: null,
  };
}

function panel(p: Json): ControlPanel {
  const { position, ...rest } = p;
  return {
    ...rest,
    // The panel's own design is not carried over (see the header), so the app draws its own list; the
    // Episodes card (`row`) is drawn from `rows`.
    component: undefined,
    placement: position
      ? { mode: 'custom', x: num(position.x) ?? 50, y: num(position.y) ?? 50 }
      : { mode: 'anchored' },
    closeOnSelect: p.closeOnSelect ?? true,
  } as ControlPanel;
}

function control(c: Json): Control {
  return {
    id: c.id,
    frame: frame(c.frame ?? {}),
    ties: c.ties,
    limits: c.limits,
    requires: c.requires ?? null,
    showWhen: c.showWhen ?? null,
    config: c.config,
    look: c.look ? atom(c.id, c.look) : null,
    panel: c.panel ? panel(c.panel) : undefined,
  };
}

function placements(opens: Json | undefined): Record<string, PanelPlacement> {
  const out: Record<string, PanelPlacement> = {};
  for (const [name, o] of Object.entries(opens ?? {})) {
    const p = o as Json;
    out[name] = {
      edge: p.edge,
      fullWidth: p.fullWidth,
      maxWidthPct: num(p.maxWidthPct),
      maxHeightPct: num(p.maxHeightPct),
      radiusPx: num(p.radius),
      corners: p.corners ?? 'none',
      backdrop: p.backdrop ?? 'none',
      gapPx: num(p.gap) ?? undefined,
      marginPx: num(p.margin) ?? undefined,
    };
  }
  return out;
}

export function adaptPlayerConfig(raw: unknown): PlayerConfig {
  const d = raw as Json;
  if (!d || d.schemaVersion !== 4) return raw as PlayerConfig;
  const rules = (d.panelRules ?? {}) as Json;
  const surface = (d.surface ?? {}) as Json;
  const device = (d.device ?? {}) as Json;
  return {
    schemaVersion: 3,
    profile: d.profile,
    version: d.version,
    deviceClass: device.class ?? 'web',
    device: { dt: device.type, unit: device.unit, unitScale: device.scale ?? 1 },
    surface: {
      aspect: '16:9',
      design: { w: surface.width, h: surface.height },
      safe: { x: surface.safe?.x ?? 0, y: surface.safe?.y ?? 0 },
    },
    controls: (d.controls ?? []).map(control),
    ad: d.adControls ? { controls: d.adControls.map(control) } : undefined,
    panelContract: {
      roles: {},
      repeat: { property: '', option: '' },
      state: { property: '', selected: '', unselected: '' },
      focus: rules.focus ?? { start: 'selected', back: 'closes', after: 'button' },
      placement: placements(rules.opens),
    },
    rows: Object.fromEntries(
      Object.entries((d.rows ?? {}) as Json).map(([id, r]) => [id, rowBlock(id, r as Json)]),
    ),
    behaviour: d.behaviour,
  } as PlayerConfig;
}
