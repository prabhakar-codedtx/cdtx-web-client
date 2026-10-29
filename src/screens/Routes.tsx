import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadPage, pageKey } from '@/app/pagesSlice';
import { DETAIL_SCREEN } from '@/lib/api/endpoints';
import { useDt } from '@/lib/device/useDt';
import { PageScreen } from '@/screens/PageScreen';

/** A screen by its slug (and the title it is opened for, on a detail screen). */
function Screen({ slug, contentId, type }: { slug: string | undefined; contentId?: string; type?: string }) {
  const dispatch = useAppDispatch();
  const dt = useDt();
  const entry = useAppSelector((s) => (slug ? s.pages.pages[pageKey(slug, contentId, dt)] : undefined));
  const viewerVersion = useAppSelector((s) => s.pages.viewerVersion);

  // Asked for again on every visit (what was published since reaches the next one), and when the
  // viewer's progress was saved (Continue Watching's count may have changed).
  useEffect(() => {
    if (slug) void dispatch(loadPage({ slug, contentId, type }));
  }, [slug, contentId, type, dt, viewerVersion, dispatch]);

  if (!slug) return <div>There is nothing to show yet.</div>;
  if (entry?.data)
    return (
      <PageScreen key={`${slug}|${contentId ?? ''}`} screen={slug} page={entry.data} contentId={contentId} />
    );
  if (entry?.status === 'failed') {
    return (
      <div role="alert">
        <strong>
          {entry.code === 404 ? "This screen isn't available." : 'This screen could not be loaded.'}
        </strong>
        <span>{entry.error}</span>
        <Link to="/">Back to the start</Link>
      </div>
    );
  }
  return <div>Loading…</div>;
}

/** `/` (the default tab) and `/p/:slug`. */
export function TabRoute() {
  const { slug } = useParams<{ slug: string }>();
  const tabs = useAppSelector((s) => s.launch.tabs);
  return <Screen slug={slug ?? (tabs.find((t) => t.isDefault) ?? tabs[0])?.slug} />;
}

/**
 * `/title/:type/:id`: the title's detail screen. The server picks the page for the title's type
 * (`detailURL`) and says which of its rails are `visible` for it; `type` is only for an older server.
 */
export function DetailRoute() {
  const { type, id } = useParams<{ type: string; id: string }>();
  if (!id) {
    return (
      <div>
        <strong>There is no detail page for this title.</strong>
        <Link to="/">Back to the start</Link>
      </div>
    );
  }
  return <Screen slug={DETAIL_SCREEN} contentId={id} type={type} />;
}
