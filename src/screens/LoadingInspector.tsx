import { useState } from 'react';
import { useAppSelector } from '@/app/hooks';
import type { PageLoading } from '@/lib/api/types';
import { clearLoadingLog, useLoadingLog, type LoadingEvent } from '@/lib/debug/loadingLog';

export interface InspectedRow {
  key: string;
  title: string;
  url: string;
  /** 0-based among the rows; -1 for the hero (always loaded at once, not counted). */
  index: number;
}

/**
 * `?loading=debug`: a panel over the page showing Page → Loading at work - the numbers the API sent for
 * this device, how many rows are let in so far, each row's titles (loaded / total), and a log of what
 * was asked for and why. For the people tuning Page → Loading in the CMS; viewers never see it.
 */
export function LoadingInspector({
  loading,
  rows,
  letIn,
  dt,
}: {
  loading: PageLoading;
  rows: InspectedRow[];
  letIn: number;
  dt: string;
}) {
  const [open, setOpen] = useState(true);
  const items = useAppSelector((s) => s.pages.items);
  const more = useAppSelector((s) => s.pages.more);
  const log = useLoadingLog();
  const counted = rows.filter((r) => r.index >= 0);
  const shownIn = Math.min(letIn, counted.length);

  const status = (r: InspectedRow): { text: string; color: string } => {
    if (r.index >= letIn) return { text: 'waiting', color: '#8a8a99' };
    const e = items[r.url];
    if (!e) return { text: 'queued', color: '#e0b04a' };
    if (e.status === 'loading') return { text: 'asking…', color: '#e0b04a' };
    if (e.status === 'failed') return { text: 'failed', color: '#ff6b6b' };
    const have = e.data?.length ?? 0;
    const total = more[r.url]?.total;
    const busy = more[r.url]?.loading ? ' +…' : '';
    return { text: `${have}${total != null ? ` / ${total}` : ''} cards${busy}`, color: '#5bd68a' };
  };

  return (
    <div
      role="complementary"
      aria-label="Loading inspector"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: open ? 380 : 'auto',
        maxHeight: '70vh',
        overflow: 'auto',
        background: 'rgba(12,12,18,0.94)',
        color: '#e6e6ef',
        border: '1px solid #33334a',
        borderRadius: 10,
        font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: open ? '1px solid #33334a' : 0,
        }}
      >
        <strong style={{ flex: 1 }}>
          Loading · rows {shownIn}/{counted.length} let in
        </strong>
        {open && (
          <button type="button" onClick={clearLoadingLog} style={buttonStyle}>
            Clear log
          </button>
        )}
        <button type="button" onClick={() => setOpen(!open)} style={buttonStyle}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div style={{ padding: '8px 10px' }}>
          <div style={{ color: '#8a8a99', marginBottom: 4 }}>From the API (Page → Loading, dt={dt})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 12px', marginBottom: 10 }}>
            <span>Rails at open</span>
            <b>{loading.railsFirst ?? '—'}</b>
            <span>Rails per scroll</span>
            <b>{loading.railsNext ?? '—'}</b>
            <span>Next rails, rows ahead</span>
            <b>{loading.railsNextWithin ?? '—'}</b>
            <span>Titles first</span>
            <b>{loading.titlesFirst ?? 'auto'}</b>
            <span>Titles per sideways scroll</span>
            <b>{loading.titlesNext ?? '—'}</b>
            <span>More titles, cards before end</span>
            <b>{loading.titlesNextWithin ?? '—'}</b>
            <span>Most titles in a rail</span>
            <b>{loading.titlesMax ?? '—'}</b>
          </div>
          <div style={{ color: '#8a8a99', marginBottom: 4 }}>Rows</div>
          <div style={{ marginBottom: 10 }}>
            {rows.map((r) => {
              const s = status(r);
              const batchEnd = r.index === letIn - 1;
              return (
                <div
                  key={r.key}
                  style={{
                    display: 'flex',
                    gap: 8,
                    borderBottom: batchEnd ? '1px dashed #e0b04a' : undefined,
                    paddingBottom: batchEnd ? 2 : 0,
                    marginBottom: batchEnd ? 2 : 0,
                  }}
                >
                  <span style={{ width: 34, color: '#8a8a99' }}>
                    {r.index < 0 ? 'hero' : `#${r.index + 1}`}
                  </span>
                  <span
                    style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {r.title}
                  </span>
                  <span style={{ color: s.color }}>{s.text}</span>
                </div>
              );
            })}
          </div>
          <LogList title="Rows log (down the page)" events={log.filter((e) => e.kind === 'rows')} />
          <LogList title="Cards log (sideways)" events={log.filter((e) => e.kind === 'cards')} limit={12} />
        </div>
      )}
    </div>
  );
}

/** One log, newest first; `limit` keeps a busy one short. */
function LogList({ title, events, limit }: { title: string; events: LoadingEvent[]; limit?: number }) {
  const shown = [...events].reverse().slice(0, limit ?? events.length);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ color: '#8a8a99', marginBottom: 4 }}>
        {title} · {events.length}
        {limit && events.length > limit ? ` (last ${limit})` : ''}
      </div>
      {shown.length === 0 && <div style={{ color: '#8a8a99' }}>nothing yet</div>}
      {shown.map((e, i) => (
        <div key={`${e.t}-${i}`}>
          <span style={{ color: '#8a8a99' }}>{(e.t / 1000).toFixed(1)}s </span>
          {e.text}
        </div>
      ))}
    </div>
  );
}

const buttonStyle = {
  background: 'transparent',
  color: '#e6e6ef',
  border: '1px solid #44445c',
  borderRadius: 6,
  padding: '1px 8px',
  font: 'inherit',
  cursor: 'pointer',
} as const;
