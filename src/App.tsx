import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { Shell } from '@/screens/Shell';
import { DetailRoute, TabRoute } from '@/screens/Routes';
import { PlayerScreen } from '@/player/PlayerScreen';
import { SeeAllScreen } from '@/screens/SeeAllScreen';

export function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<TabRoute />} />
            <Route path="p/:slug" element={<TabRoute />} />
            <Route path="title/:type/:id" element={<DetailRoute />} />
            <Route path="play/:type/:id" element={<PlayerScreen />} />
            <Route path="list/:slug/:key" element={<SeeAllScreen />} />
            <Route path="*" element={<TabRoute />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}
