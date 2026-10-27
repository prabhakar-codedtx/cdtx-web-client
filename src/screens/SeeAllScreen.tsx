import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { getPage, getRailItems } from '@/lib/api/endpoints';
import type { Block, Rail, Title } from '@/lib/api/types';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import { useElementWidth } from '@/lib/device/useElementWidth';
import { CardView } from '@/render/CardView';
import { NAV_HEIGHT } from '@/screens/navMetrics';
import { cardSize } from '@/screens/Rail';
import { useTitleActions } from '@/screens/useTitleActions';

/** Titles asked for in one call. */
const PAGE = 40;

/** The rail's own `source.contentUrl` asking for `limit` titles from `offset` (the server pages by offset). */
function pageOf(contentUrl: string, offset: number): string {
  const u = new URL(contentUrl, 'http://api.invalid');
  u.searchParams.set('limit', String(PAGE));
  u.searchParams.set('offset', String(offset));
  return `${u.pathname}${u.search}`;
}

/**
 * `/list/:slug/:key`: all the titles of one rail in a grid, opened from its "See all". The rail and its
 * card design come with the tap; opened from a link or a reload they are read from the page again.
 * The titles are the rail's own list (`source.contentUrl`), asked for in pages.
 */
export function SeeAllScreen() {
  const { slug, key } = useParams<{ slug: string; key: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const launch = useAppSelector((s) => s.launch.launch);
  const { open, act } = useTitleActions();
  const sent = location.state as { rail?: Rail; block?: Block | null } | null;
  const [found, setFound] = useState<{ rail: Rail; block: Block | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<Title[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [widthRef, available] = useElementWidth<HTMLDivElement>();

  const rail = sent?.rail ?? found?.rail ?? null;
  const block = sent?.rail ? (sent.block ?? null) : (found?.block ?? null);

  // Opened without the tap (a link, a reload): the rail is read from its page.
  useEffect(() => {
    if (sent?.rail || !launch || !slug || !key) return;
    let live = true;
    getPage(launch, slug, getDeliveryContext(), {}).then(
      (p) => {
        const r = p.rails.find((x) => x.key === key);
        if (!live) return;
        if (r) setFound({ rail: r, block: r.blockKey ? (p.blocks[r.blockKey] ?? null) : null });
        else setFailed(true);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [sent, launch, slug, key]);

  const url = rail?.source.contentUrl ?? null;
  const [first, setFirst] = useState(true);

  // The first page, once the rail's list is known.
  useEffect(() => {
    if (!url) return;
    let live = true;
    getRailItems(pageOf(url, 0)).then(
      (list) => {
        if (!live) return;
        setItems(list);
        setMore(list.length >= PAGE);
        setFirst(false);
      },
      () => {
        if (!live) return;
        setMore(false);
        setFirst(false);
      },
    );
    return () => {
      live = false;
    };
  }, [url]);

  // "Show more": the next page.
  const showMore = () => {
    if (!url || busy) return;
    setBusy(true);
    getRailItems(pageOf(url, items.length)).then(
      (list) => {
        setItems((prev) => [...prev, ...list]);
        setMore(list.length >= PAGE);
        setBusy(false);
      },
      () => {
        setMore(false);
        setBusy(false);
      },
    );
  };

  if (failed) {
    return (
      <div role="alert" style={{ padding: 24, paddingTop: NAV_HEIGHT + 24 }}>
        <strong>This list isn&apos;t available.</strong> <Link to="/">Back to the start</Link>
      </div>
    );
  }
  if (!rail) return <div style={{ padding: 24, paddingTop: NAV_HEIGHT + 24 }}>Loading…</div>;

  const rl = rail.railLayout;
  const gap = rl.gap ?? 12;
  const side = 24;
  const lane = Math.max(0, available - 2 * side);
  const size = block ? cardSize(rl, block, 'grid', lane, items.length) : { w: 0, h: 0 };
  const name = rail.title || rail.seeAll.label || 'All titles';

  return (
    <main style={{ paddingTop: NAV_HEIGHT, minHeight: '100vh' }}>
      <div ref={widthRef} style={{ padding: `16px ${side}px 48px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button type="button" aria-label="Back" onClick={() => navigate(-1)}>
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: 22 }}>{name}</h1>
        </div>
        {!block ? (
          <div role="alert">This rail has no card design to draw its titles with.</div>
        ) : (
          <div
            role="list"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, ${size.w}px)`,
              gap,
              justifyContent: 'start',
            }}
          >
            {items.map((t) => (
              <div key={t.id} role="listitem" style={{ width: size.w, height: size.h }}>
                <CardView
                  block={block}
                  title={t}
                  width={size.w}
                  height={size.h}
                  onOpen={(x) => open(x, rail)}
                  onAction={act}
                />
              </div>
            ))}
          </div>
        )}
        {more && items.length > 0 && (
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button type="button" disabled={busy} onClick={showMore}>
              {busy ? 'Loading…' : 'Show more'}
            </button>
          </div>
        )}
        {!first && items.length === 0 && <div>There is nothing in this list yet.</div>}
      </div>
    </main>
  );
}
