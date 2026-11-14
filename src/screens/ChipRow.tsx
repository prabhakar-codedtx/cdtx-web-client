import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { RailChip } from '@/lib/api/types';

/**
 * A chip rail (`CMS docs/client-contract/FILTERED-RAILS.md`): the row of chips above the cards. The
 * server already left out chips the viewer is not shown, and gives them in the editor's order, in
 * the viewer's language; the client only draws them and switches which one's titles are shown.
 */

export function ChipRow({
  chips,
  selected,
  onSelect,
  fontFamily,
  paddingLeft,
  paddingRight,
  marginBottom,
}: {
  chips: RailChip[];
  selected: string | null;
  onSelect: (key: string) => void;
  fontFamily?: string;
  paddingLeft: number;
  paddingRight: number;
  marginBottom: number;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  if (chips.length === 0) return null;

  // Left / right move between chips (a tablist): the remote's D-pad on a TV browser, arrows on a keyboard.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const at = chips.findIndex((c) => c.key === selected);
    const next = Math.min(chips.length - 1, Math.max(0, at + (e.key === 'ArrowRight' ? 1 : -1)));
    if (next === at) return;
    e.preventDefault();
    onSelect(chips[next]!.key);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Filter"
      onKeyDown={onKeyDown}
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        paddingLeft,
        paddingRight,
        marginBottom,
      }}
    >
      {chips.map((c, i) => {
        const on = c.key === selected;
        const style: CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          flex: '0 0 auto',
          padding: '6px 14px',
          borderRadius: 8,
          border: `1px solid ${on ? '#ffffff' : 'rgba(255,255,255,0.22)'}`,
          background: on ? '#ffffff' : 'rgba(255,255,255,0.08)',
          color: on ? '#000000' : '#e8e8ee',
          fontFamily,
          fontSize: 13,
          fontWeight: on ? 700 : 500,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        };
        return (
          <button
            key={c.key}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(c.key)}
            style={style}
          >
            {c.icon && (
              <img
                src={c.icon}
                alt=""
                style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
              />
            )}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
