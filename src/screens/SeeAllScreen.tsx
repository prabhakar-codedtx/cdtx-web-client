import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { getPage, getRailItems } from '@/lib/api/endpoints';
import type { Block, Fill, Rail, SeeAllPageDesign, Title } from '@/lib/api/types';
import { fillCss, textCss } from '@/lib/render/paint';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import { useElementWidth } from '@/lib/device/useElementWidth';
import { CardView } from '@/render/CardView';
import { NAV_HEIGHT } from '@/screens/navMetrics';
import { cardSize } from '@/screens/Rail';
import { useTitleActions } from '@/screens/useTitleActions';

/** The design of this page when the server sends none (an older server): what it sent before it did. */
const FALLBACK: SeeAllPageDesign = {
  sidePadding: 24,
  topPadding: 16,
  bottomPadding: 48,
  titleScale: 1.4,
  titleGap: 14,
  titleMarginBottom: 20,
  pageSize: 40,
  backButton: { shape: 'circle', size: 40, iconSize: 20, background: '#ffffff24', color: null },
  showMore: { label: 'Show more', shape: 'pill', borderWidth: 1, paddingX: 22, paddingY: 8, marginTop: 28 },
};

/** The rail's own `source.contentUrl` asking for `limit` titles from `offset` (the server pages by offset). */
function pageOf(contentUrl: string, offset: number, limit: number): string {
  const u = new URL(contentUrl, 'http://api.invalid');
  u.searchParams.set('limit', String(limit));
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
  const sent = location.state as {
    rail?: Rail;
    block?: Block | null;
    background?: Fill | null;
    design?: SeeAllPageDesign | null;
  } | null;
  const [found, setFound] = useState<{
    rail: Rail;
    block: Block | null;
    background: Fill | null;
    design: SeeAllPageDesign | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState<Title[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [widthRef, available] = useElementWidth<HTMLDivElement>();

  const rail = sent?.rail ?? found?.rail ?? null;
  const block = sent?.rail ? (sent.block ?? null) : (found?.block ?? null);
  const background = sent?.rail ? (sent.background ?? null) : (found?.background ?? null);
  const d = (sent?.rail ? sent.design : found?.design) ?? FALLBACK;

  // Opened without the tap (a link, a reload): the rail is read from its page.
  useEffect(() => {
    if (sent?.rail || !launch || !slug || !key) return;
    let live = true;
    getPage(launch, slug, getDeliveryContext(), {}).then(
      (p) => {
        const r = p.rails.find((x) => x.key === key);
        if (!live) return;
        if (r)
          setFound({
            rail: r,
            block: r.blockKey ? (p.blocks[r.blockKey] ?? null) : null,
            background: p.background,
            design: p.seeAllPage ?? null,
          });
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
    getRailItems(pageOf(url, 0, d.pageSize)).then(
      (list) => {
        if (!live) return;
        setItems(list);
        setMore(list.length >= d.pageSize);
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
    getRailItems(pageOf(url, items.length, d.pageSize)).then(
      (list) => {
        setItems((prev) => [...prev, ...list]);
        setMore(list.length >= d.pageSize);
        setBusy(false);
      },
      () => {
        setMore(false);
        setBusy(false);
      },
    );
  };

  const ink = rail?.titleStyle.color ?? '#ffffff';
  // The page's own background, so the list reads as part of the same app.
  const frame: CSSProperties = { ...fillCss(background), minHeight: '100vh', color: ink };
  const moreBtn = d.showMore;
  const pill: CSSProperties = {
    border: `${moreBtn.borderWidth}px solid ${ink}`,
    background: 'transparent',
    color: ink,
    borderRadius: moreBtn.shape === 'rounded' ? 8 : 999,
    padding: `${moreBtn.paddingY}px ${moreBtn.paddingX}px`,
    font: 'inherit',
    cursor: 'pointer',
  };

  if (failed) {
    return (
      <main
        ref={widthRef}
        style={{ ...frame, padding: d.sidePadding, paddingTop: NAV_HEIGHT + d.sidePadding }}
      >
        <div role="alert">
          <strong>This list isn&apos;t available.</strong>{' '}
          <Link to="/" style={{ color: ink }}>
            Back to the start
          </Link>
        </div>
      </main>
    );
  }
  if (!rail)
    return (
      <main
        ref={widthRef}
        style={{ ...frame, padding: d.sidePadding, paddingTop: NAV_HEIGHT + d.sidePadding }}
      >
        Loading…
      </main>
    );

  const rl = rail.railLayout;
  const gap = rl.gap ?? 12;
  const side = d.sidePadding;
  const back = d.backButton;
  const lane = Math.max(0, available - 2 * side);
  const size = block ? cardSize(rl, block, 'grid', lane, items.length) : { w: 0, h: 0 };
  const name = rail.title || rail.seeAll.label || 'All titles';

  return (
    <main ref={widthRef} style={{ ...frame, paddingTop: NAV_HEIGHT }}>
      <div style={{ padding: `${d.topPadding}px ${side}px ${d.bottomPadding}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: d.titleGap,
            marginBottom: d.titleMarginBottom,
          }}
        >
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            style={{
              width: back.size,
              height: back.size,
              display: 'grid',
              placeItems: 'center',
              border: 'none',
              borderRadius: back.shape === 'square' ? 8 : '50%',
              background: back.background ?? 'transparent',
              color: back.color ?? ink,
              cursor: 'pointer',
              flex: '0 0 auto',
            }}
          >
            <svg
              width={back.iconSize}
              height={back.iconSize}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 style={{ ...textCss(rail.titleStyle, d.titleScale), margin: 0 }}>{name}</h1>
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
          <div style={{ marginTop: moreBtn.marginTop, textAlign: 'center' }}>
            <button type="button" disabled={busy} onClick={showMore} style={pill}>
              {busy ? 'Loading…' : moreBtn.label}
            </button>
          </div>
        )}
        {!first && items.length === 0 && <div>There is nothing in this list yet.</div>}
      </div>
    </main>
  );
}
