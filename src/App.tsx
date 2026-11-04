import { BrowserRouter, Route, Routes, useLocation, type Location } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useAppSelector } from '@/app/hooks';
import { store } from '@/app/store';
import { Shell } from '@/screens/Shell';
import { DetailDialog } from '@/screens/DetailDialog';
import { DetailRoute, TabRoute } from '@/screens/Routes';
import { PlayerScreen } from '@/player/PlayerScreen';
import { SeeAllScreen } from '@/screens/SeeAllScreen';

/**
 * The routes. When details open as a dialog the navigation carries the screen the viewer was on
 * (`state.background`): that screen is the one drawn, and `DetailDialog` (in `Shell`) draws the title
 * over it. A page loaded straight at `/title/...` has no background, so it is the full detail page.
 * Inside `Routes`, `useLocation` is the background; the dialog is drawn out here, where it is the real one.
 */
function AppRoutes() {
  const location = useLocation();
  const ready = useAppSelector((s) => s.launch.status === 'ready');
  const background = (location.state as { background?: Location } | null)?.background;
  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<Shell />}>
          <Route index element={<TabRoute />} />
          <Route path="p/:slug" element={<TabRoute />} />
          <Route path="title/:type/:id" element={<DetailRoute />} />
          <Route path="play/:type/:id" element={<PlayerScreen />} />
          <Route path="list/:slug/:key" element={<SeeAllScreen />} />
          <Route path="*" element={<TabRoute />} />
        </Route>
      </Routes>
      {background && ready && <DetailDialog />}
    </>
  );
}

export function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}
