import { useEffect } from 'react';
import styled from 'styled-components';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadHome, selectContainers, switchTab } from '@/features/home/homeSlice';
import { TopNav } from '@/features/home/components/TopNav';
import { Rail } from '@/features/home/components/Rail';
import type { DeliveryItem } from '@/lib/api/types';
import { createLogger } from '@/lib/logger/logger';

const log = createLogger('home-screen');

/**
 * `TopNav` is `position: fixed` (see that file), so it no longer reserves
 * its own space — a tab whose first row is the hero banner wants that
 * (the banner is meant to run the full `100vh` *under* the nav), but a tab
 * that opens with a plain rail still needs that much clearance or its own
 * title/cards render half-hidden behind the fixed bar. `$offsetForNav`
 * adds it back only in that second case.
 */
const Page = styled.main<{ $offsetForNav: boolean }>`
  min-height: 100%;
  padding-top: ${(p) => (p.$offsetForNav ? `${p.theme.navHeightPx}px` : 0)};
  padding-bottom: ${({ theme }) => theme.space(4)};
`;

const StateMessage = styled.p`
  padding: ${({ theme }) => theme.space(4)};
  color: ${({ theme }) => theme.color.textMuted};
  text-align: center;
`;

export function HomeScreen() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.home.status);
  const error = useAppSelector((s) => s.home.error);
  const storefront = useAppSelector((s) => s.home.storefront);
  const activeTab = useAppSelector((s) => s.home.activeTab);
  const containers = useAppSelector(selectContainers);

  useEffect(() => {
    dispatch(loadHome(undefined));
  }, [dispatch]);

  const handleSelectItem = (item: DeliveryItem) => {
    // No detail-page endpoint exists yet on the delivery API — logged for
    // now rather than navigating somewhere that would 404.
    log.info(`selected "${item.name}" (${item.content_type})`, { id: item.id });
  };

  if (status === 'failed') {
    return <StateMessage role="alert">Couldn't load the storefront — {error}</StateMessage>;
  }

  if (!storefront || !activeTab) {
    return <StateMessage>Loading…</StateMessage>;
  }

  return (
    <Page $offsetForNav={containers[0]?.layout !== 'banner'}>
      <TopNav
        storefront={storefront}
        activeTabId={activeTab.id}
        onSelectTab={(tabId) => dispatch(switchTab(tabId))}
      />
      {containers.map((container) => (
        <Rail key={container.id} container={container} onSelectItem={handleSelectItem} />
      ))}
    </Page>
  );
}
