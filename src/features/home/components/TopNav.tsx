import styled from 'styled-components';
import type { DeliveryStorefront } from '@/lib/api/types';

/**
 * `fixed`, not `sticky` — `sticky` still reserves its own box in normal
 * flow until the page scrolls past it, which is exactly what kept the hero
 * from ever reaching the real top of the viewport (it always started one
 * nav-height down). `fixed` takes the bar out of flow entirely, so it
 * floats over whatever is at `top: 0` — a full-`100vh` hero behind it, or a
 * plain rail's own top padding in front of it (see `HomeScreen`'s
 * `navHeightPx` offset for that second case).
 *
 * A light, flat tint rather than the earlier heavy two-stop gradient — just
 * enough to separate the bar from whatever's behind it (hero image, or a
 * rail's cards once scrolled) without reintroducing a solid-looking
 * header bar. Kept alongside the text-shadow below, not instead of it: a
 * tint this faint alone still isn't reliable over a bright hero frame.
 */
const Bar = styled.header`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  min-height: ${({ theme }) => theme.navHeightPx}px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};
  padding: ${({ theme }) => theme.space(2)};
  background: rgba(11, 11, 15, 0.28);
  backdrop-filter: blur(4px);
`;

/** Text-shadow stands in for the removed background scrim — without either,
 * white nav text disappears against a bright hero image. */
const Brand = styled.span`
  font-weight: 700;
  font-size: 18px;
  flex: 0 0 auto;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
`;

const Tabs = styled.nav`
  display: flex;
  gap: ${({ theme }) => theme.space(2)};
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 0 0 auto;
  border: none;
  background: none;
  padding: ${({ theme }) => theme.space(0.5)} 0;
  font-size: 14px;
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  color: ${(p) => (p.$active ? p.theme.color.text : p.theme.color.textMuted)};
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.color.accent};
    outline-offset: 4px;
  }
`;

interface TopNavProps {
  storefront: DeliveryStorefront;
  activeTabId: string | undefined;
  onSelectTab: (tabId: string) => void;
}

export function TopNav({ storefront, activeTabId, onSelectTab }: TopNavProps) {
  return (
    <Bar>
      <Brand>{storefront.name}</Brand>
      <Tabs aria-label="Storefront tabs">
        {storefront.tabs.map((tab) => (
          <TabButton
            key={tab.id}
            $active={tab.id === activeTabId}
            aria-current={tab.id === activeTabId}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.name}
          </TabButton>
        ))}
      </Tabs>
    </Bar>
  );
}
