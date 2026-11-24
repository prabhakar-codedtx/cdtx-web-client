import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAppSelector } from '@/app/hooks';
import { useLanguageScreen } from '@/lib/api/languageScreen';
import { savedChoice } from '@/lib/language/choice';
import { pickerOf, profileTypesOf } from '@/lib/profiles/launch';
import { useProfiles } from '@/lib/profiles/profiles';

/**
 * The round profile icon at the right end of the tab bar: a light circle with the person in it. It is
 * always there. When the CMS has Profiles ("Who's watching?") or the language screen on, it opens a
 * small menu with those places, each saying what is chosen now (the profile watching, the languages);
 * with neither on there is nothing to open and the icon only stands in the corner.
 *
 * It does not depend on the bar around it: the colours come from `look` (the CMS's navigation design),
 * else from the client's own tab bar variables.
 */

export interface MenuLook {
  /** The circle, and the words in the menu. */
  ink: string;
  /** The person inside the circle (the bar's colour), and the menu's own background. */
  surface: string;
}

const DEFAULT_LOOK: MenuLook = { ink: 'var(--nav-text, #ffffff)', surface: 'var(--nav-panel, #16161d)' };

type Where = 'top' | 'bottom' | 'side';

const Root = styled.div<{ $where: Where }>`
  position: relative;
  flex: none;
  ${(p) => (p.$where === 'side' ? 'margin-top: auto; align-self: center;' : 'margin-left: auto;')}
`;

const Avatar = styled.button<{ $look: MenuLook }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: ${(p) => p.$look.ink};
  color: ${(p) => p.$look.surface};
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  &:hover {
    filter: brightness(0.92);
  }
  &:focus-visible {
    outline: 2px solid ${(p) => p.$look.ink};
    outline-offset: 3px;
  }
  &:disabled {
    cursor: default;
    filter: none;
  }
`;

const Panel = styled.div<{ $look: MenuLook; $where: Where; $sideWidth: number }>`
  z-index: 30;
  min-width: 240px;
  padding: 8px 0;
  border-radius: 12px;
  background: ${(p) => p.$look.surface};
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  ${(p) =>
    p.$where === 'side'
      ? `position: fixed; left: ${p.$sideWidth + 8}px; bottom: 16px;`
      : p.$where === 'bottom'
        ? 'position: absolute; right: 0; bottom: calc(100% + 8px);'
        : 'position: absolute; right: 0; top: calc(100% + 8px);'}
`;

const Item = styled.button<{ $look: MenuLook }>`
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 10px 20px;
  border: 0;
  background: none;
  color: ${(p) => p.$look.ink};
  font: inherit;
  text-align: left;
  cursor: pointer;
  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.1);
    outline: none;
  }
  &[aria-current='page'] {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    style={{ flex: 'none' }}
  >
    {children}
  </svg>
);

/** The person in the circle: a head and shoulders, filled. */
const PersonFilled = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="8.2" r="4.2" />
    <path d="M3.5 21c0-4.4 3.8-7.4 8.5-7.4s8.5 3 8.5 7.4z" />
  </svg>
);

const PersonIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </Icon>
);

const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.6 2.6 3.9 5.6 3.9 9S14.6 18.4 12 21c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" />
  </Icon>
);

interface Entry {
  key: 'profiles' | 'language';
  label: string;
  value: string;
  to: string;
  icon: ReactNode;
}

export function ProfileMenu({
  look = DEFAULT_LOOK,
  where = 'top',
  sideWidth = 0,
}: {
  look?: MenuLook;
  /** Where the bar is: the menu opens below it (top), above it (bottom) or beside it (side). */
  where?: Where;
  /** The sidebar's width, px, so its menu opens beside it. */
  sideWidth?: number;
}) {
  const launch = useAppSelector((s) => s.launch.launch);
  const raw = launch?.raw;
  const profilesOn = profileTypesOf(raw).length > 0 && pickerOf(raw) !== null;
  const { profiles, activeId } = useProfiles();
  const me = profiles.find((p) => p.id === activeId) ?? null;
  const { screen } = useLanguageScreen(launch);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Open on the screen it was opened on: going anywhere else closes it, with no effect to do so.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const wrap = useRef<HTMLDivElement>(null);

  // Closes on a tap elsewhere and on Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpenOn(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const entries: Entry[] = [];
  if (profilesOn) {
    entries.push({
      key: 'profiles',
      label: 'Profiles',
      value: me ? me.name : 'Who’s watching?',
      to: '/profiles',
      icon: <PersonIcon />,
    });
  }
  if (screen) {
    // What is chosen now, in the words the screen shows; the default language before any choice.
    const codes = savedChoice()?.codes ?? [];
    const picked = screen.languages.filter((l) => codes.includes(l.code));
    const shown = picked.length > 0 ? picked : screen.languages.filter((l) => l.isDefault).slice(0, 1);
    entries.push({
      key: 'language',
      label: 'Language',
      value: shown.map((l) => l.nativeName ?? l.name).join(', ') || 'Choose',
      to: '/language',
      icon: <GlobeIcon />,
    });
  }

  const face = me ? me.name.charAt(0).toUpperCase() : <PersonFilled />;
  return (
    <Root ref={wrap} $where={where}>
      <Avatar
        type="button"
        $look={look}
        // With nothing to open it is only the icon in the corner.
        disabled={entries.length === 0}
        aria-haspopup={entries.length > 0 ? 'menu' : undefined}
        aria-expanded={entries.length > 0 ? open : undefined}
        aria-label={me ? `Profile: ${me.name}` : 'Profile'}
        onClick={() => setOpenOn(open ? null : pathname)}
      >
        {face}
      </Avatar>
      {open && entries.length > 0 && (
        <Panel role="menu" $look={look} $where={where} $sideWidth={sideWidth}>
          {entries.map((e) => (
            <Item
              key={e.key}
              type="button"
              role="menuitem"
              $look={look}
              aria-current={pathname.startsWith(e.to) ? 'page' : undefined}
              onClick={() => navigate(e.to)}
            >
              {e.icon}
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{e.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>{e.value}</span>
              </span>
            </Item>
          ))}
        </Panel>
      )}
    </Root>
  );
}
