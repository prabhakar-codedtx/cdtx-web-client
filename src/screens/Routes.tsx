import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadPage, pageKey } from '@/app/pagesSlice';
import { DETAIL_PAGES } from '@/lib/config';
import { useDt } from '@/lib/device/useDt';
import { PageScreen } from '@/screens/PageScreen';

/** A screen by its slug (and the title it is opened for, on a detail screen). */
function Screen({ slug, contentId }: { slug: string | undefined; contentId?: string }) {
  const dispatch = useAppDispatch();
  const dt = useDt();
  const entry = useAppSelector((s) => (slug ? s.pages.pages[pageKey(slug, contentId, dt)] : undefined));

  // Asked for again on every visit: what was published since reaches the next one.
  useEffect(() => {
    if (slug) void dispatch(loadPage({ slug, contentId }));
  }, [slug, contentId, dt, dispatch]);

  if (!slug) return <div>There is nothing to show yet.</div>;
  if (entry?.data)
    return <PageScreen key={`${slug}|${contentId ?? ''}`} page={entry.data} contentId={contentId} />;
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

/** `/title/:type/:id`: the detail screen for that kind of title, opened for that title. */
export function DetailRoute() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const slug = type ? DETAIL_PAGES[type] : undefined;
  if (!slug || !id) {
    return (
      <div>
        <strong>There is no detail page for this kind of title.</strong>
        <Link to="/">Back to the start</Link>
      </div>
    );
  }
  return <Screen slug={slug} contentId={id} />;
}
