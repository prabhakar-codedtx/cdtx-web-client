import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { boot } from '@/app/launchSlice';
import { clearToast } from '@/app/uiSlice';
import { useDt } from '@/lib/device/useDt';
import { TopNav } from '@/screens/TopNav';

/**
 * The frame every screen sits in: it starts the client (launch config, then the tabs), holds the tab
 * bar, and answers for the launch flags: under maintenance or past a forced update, nothing else shows.
 */
export function Shell() {
  const dispatch = useAppDispatch();
  const dt = useDt();
  const { pathname } = useLocation();
  const { status, error, launch } = useAppSelector((s) => s.launch);
  const toast = useAppSelector((s) => s.ui.toast);

  // Start, and ask again for the tabs when the window changes into or out of a phone's width.
  useEffect(() => {
    void dispatch(boot());
  }, [dispatch, dt]);

  // A new screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => dispatch(clearToast()), 3200);
    return () => window.clearTimeout(t);
  }, [toast, dispatch]);

  if (status === 'failed') {
    return (
      <div role="alert">
        <strong>The storefront could not be loaded.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => void dispatch(boot())}>Try again</button>
      </div>
    );
  }
  if (!launch) return <div>Loading…</div>;
  if (launch.maintenanceEnabled) {
    return (
      <div role="status">
        <strong>We will be back soon.</strong>
        <span>{launch.maintenanceMessage ?? 'The service is under maintenance.'}</span>
      </div>
    );
  }
  if (launch.forceUpdate) {
    return (
      <div role="status">
        <strong>An update is required.</strong>
        <span>Please reload to get the latest version.</span>
      </div>
    );
  }
  return (
    <>
      <TopNav />
      {status === 'ready' ? <Outlet /> : <div>Loading…</div>}
      {toast && <div role="status">{toast.text}</div>}
    </>
  );
}
