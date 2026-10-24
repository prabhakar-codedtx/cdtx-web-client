import { useEffect, useRef, type CSSProperties } from 'react';
import type { Control, PanelPlacement, PlayerConfig } from '@/lib/api/player';
import type { Atom, Block } from '@/lib/api/types';
import { fillCss } from '@/lib/render/paint';
import { AtomView, type PartCtx } from '@/render/Parts';
import type { Media, Option } from '@/player/useMedia';

/**
 * A panel a control opens (Quality, Audio, Subtitles, Audio and subtitles, Episodes, Speed, Settings):
 * placed as `panelContract.placement[panel.opens]` says, drawn from its design in `panels` when the
 * design marks its atoms by role, and filled with the data `panel.data` names. A panel without a
 * design (or whose design carries no roles) is the client's own plain list.
 */

export interface Group {
  title: string | null;
  options: Option[];
  pick: (id: string) => void;
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** What a panel lists, from `panel.data` and the stream (`renditions`, `audioTracks`, `subtitleTracks`). */
export function panelGroups(
  control: Control,
  media: Media,
  openOther: (id: string) => void,
): { title: string | null; groups: Group[] } {
  const data = control.panel?.data;
  const subtitles = (first: string | undefined): Group => ({
    title: null,
    options: [
      {
        id: '__off',
        label: first ?? 'Off',
        detail: null,
        selected: !media.subtitleOptions.some((o) => o.selected),
      },
      ...media.subtitleOptions,
    ],
    pick: (id) => media.pickSubtitle(id === '__off' ? null : id),
  });
  const audio: Group = { title: null, options: media.audioOptions, pick: media.pickAudio };
  switch (control.id) {
    case 'quality':
      // A plain `<video>` stream has no renditions to choose from: only the first option ("Auto").
      return {
        title: data?.title ?? null,
        groups: [
          {
            title: null,
            options: [{ id: 'auto', label: data?.firstOption ?? 'Auto', detail: null, selected: true }],
            pick: () => undefined,
          },
        ],
      };
    case 'audio':
      return { title: data?.title ?? null, groups: [audio] };
    case 'subtitles':
      return { title: data?.title ?? null, groups: [subtitles(data?.firstOption)] };
    case 'audioSubtitles':
      return {
        title: data?.title ?? null,
        groups: (data?.groups ?? []).map((g) =>
          g.source === 'subtitleTracks'
            ? { ...subtitles(g.firstOption), title: g.title }
            : { ...audio, title: g.title },
        ),
      };
    case 'speed':
      return {
        title: data?.title ?? null,
        groups: [
          {
            title: null,
            options: RATES.map((r) => ({
              id: String(r),
              label: `${r}x`,
              detail: null,
              selected: media.rate === r,
            })),
            pick: (id) => media.setRate(Number(id)),
          },
        ],
      };
    case 'settings': {
      const items = Array.isArray(control.config?.items) ? (control.config!.items as string[]) : [];
      return {
        title: data?.title ?? null,
        groups: [
          {
            title: null,
            options: items.map((id) => ({ id, label: id, detail: null, selected: false })),
            pick: openOther,
          },
        ],
      };
    }
    case 'episodes':
      // The episodes of the season playing: the delivery API has no call for them yet.
      return { title: data?.title ?? null, groups: [] };
    default:
      return { title: data?.title ?? null, groups: [] };
  }
}

/** Where the panel sits, from `panelContract.placement` (lengths in the device unit, times `k`). */
function placementCss(
  p: PanelPlacement | undefined,
  control: Control,
  k: number,
  anchor: DOMRect | null,
  surface: DOMRect | null,
): CSSProperties {
  const custom = control.panel?.placement.mode === 'custom' ? control.panel.placement : null;
  const r = (p?.radiusPx ?? 0) * k;
  const corners = p?.corners === 'top' ? `${r}px ${r}px 0 0` : p?.corners === 'all' ? `${r}px` : undefined;
  const base: CSSProperties = {
    position: 'absolute',
    overflow: 'auto',
    borderRadius: corners,
    maxWidth: p?.maxWidthPct ? `${p.maxWidthPct}%` : undefined,
    maxHeight: p?.maxHeightPct ? `${p.maxHeightPct}%` : undefined,
  };
  if (custom)
    return {
      ...base,
      left: `${custom.x ?? 50}%`,
      top: `${custom.y ?? 50}%`,
      transform: 'translate(-50%, -50%)',
    };
  switch (p?.edge) {
    case 'right':
      return { ...base, top: 0, right: 0, bottom: 0 };
    case 'bottom':
      return { ...base, left: 0, bottom: 0, ...(p.fullWidth ? { right: 0 } : {}) };
    case 'above-button':
      if (anchor && surface) {
        return {
          ...base,
          left: Math.max((p.marginPx ?? 0) * k, anchor.left - surface.left),
          bottom: surface.bottom - anchor.top + (p.gapPx ?? 0) * k,
        };
      }
      return { ...base, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    default:
      // `centre`, or no placement sent.
      return { ...base, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }
}

/** An atom with the words of its text layers (or its own) replaced. */
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

export function Panel({
  control,
  config,
  media,
  k,
  anchor,
  surface,
  onClose,
  openOther,
}: {
  control: Control;
  config: PlayerConfig;
  media: Media;
  /** Device unit to screen: `surface width / surface.design.w`. */
  k: number;
  anchor: DOMRect | null;
  surface: DOMRect | null;
  onClose: () => void;
  openOther: (id: string) => void;
}) {
  const panel = control.panel;
  const contract = config.panelContract;
  const placement = contract?.placement[panel?.opens ?? ''];
  const design: Block | undefined = panel?.component ? config.panels?.[panel.component] : undefined;
  const { title, groups } = panelGroups(control, media, openOther);
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus starts on the selected option; Back (Escape) closes it (`panelContract.focus`).
  useEffect(() => {
    const el =
      rootRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      rootRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]');
    el?.focus();
  }, []);

  const choose = (g: Group, id: string) => {
    g.pick(id);
    if (panel?.closeOnSelect !== false && control.id !== 'settings') onClose();
  };

  // The design draws the panel when its atoms say their role; roles are the contract's words.
  const roles = contract?.roles ?? {};
  const roleOf = (a: Atom): string | null =>
    a.role ?? ((a as unknown as Record<string, unknown>).panelRole as string | null) ?? null;
  const repeatOf = (a: Atom): boolean =>
    Boolean(contract) &&
    (a as unknown as Record<string, unknown>)[contract!.repeat.property] === contract!.repeat.option;
  const usable = design && design.atoms.some((a) => roleOf(a) && Object.values(roles).includes(roleOf(a)!));
  const ctx: PartCtx = { title: null, fit: 1, cardW: design?.card.width ?? 0, aspect: null };

  const options = (g: Group) =>
    g.options.map((o) => {
      const rowAtoms = usable ? design!.atoms.filter(repeatOf) : [];
      return (
        <div
          key={o.id}
          role="menuitemradio"
          aria-checked={o.selected}
          tabIndex={0}
          onClick={() => choose(g, o.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose(g, o.id);
            }
          }}
          style={usable ? { display: 'flex', alignItems: 'center' } : undefined}
        >
          {usable
            ? rowAtoms.map((a) => {
                const role = roleOf(a);
                if (a.showWhen === contract!.state.selected && !o.selected) return null;
                if (a.showWhen === contract!.state.unselected && o.selected) return null;
                const atom = { ...a, showWhen: null };
                if (role === roles.label)
                  return <AtomView key={a.id} atom={withText(atom, o.label)} ctx={ctx} inFrame={false} />;
                if (role === roles.detail)
                  return o.detail ? (
                    <AtomView key={a.id} atom={withText(atom, o.detail)} ctx={ctx} inFrame={false} />
                  ) : null;
                return <AtomView key={a.id} atom={atom} ctx={ctx} inFrame={false} />;
              })
            : `${o.selected ? '✓ ' : ''}${o.label}${o.detail ? ` ${o.detail}` : ''}`}
        </div>
      );
    });

  return (
    <div
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.stopPropagation();
          onClose();
        }
      }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        // `backdrop: dim` darkens the player behind the panel.
        background: placement?.backdrop === 'dim' ? 'rgba(0, 0, 0, 0.5)' : undefined,
      }}
    >
      <div
        ref={rootRef}
        role="dialog"
        aria-label={title ?? control.id}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...placementCss(placement, control, k, anchor, surface),
          ...(design ? fillCss(design.card.background) : {}),
        }}
      >
        <div style={usable ? { display: 'flex', alignItems: 'center' } : undefined}>
          {usable ? (
            design!.atoms
              .filter((a) => !repeatOf(a))
              .map((a) => {
                const role = roleOf(a);
                if (role === roles.title)
                  return <AtomView key={a.id} atom={withText(a, title ?? '')} ctx={ctx} inFrame={false} />;
                if (role === roles.close)
                  return (
                    <div key={a.id} role="button" tabIndex={0} aria-label="Close" onClick={onClose}>
                      <AtomView atom={a} ctx={ctx} inFrame={false} />
                    </div>
                  );
                return null;
              })
          ) : (
            <>
              {title && <strong>{title}</strong>}
              <button type="button" onClick={onClose}>
                Close
              </button>
            </>
          )}
        </div>
        {groups.map((g, i) => (
          <div key={i} role="menu" aria-label={g.title ?? title ?? undefined}>
            {g.title && <div>{g.title}</div>}
            {options(g)}
          </div>
        ))}
        {groups.length === 0 && <div>Nothing to choose from for this title.</div>}
      </div>
    </div>
  );
}
