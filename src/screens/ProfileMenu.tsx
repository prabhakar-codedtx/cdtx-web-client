import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useLanguageScreen } from '@/lib/api/languageScreen';
import { savedChoice } from '@/lib/language/choice';
import { pickerOf, profileTypesOf } from '@/lib/profiles/launch';
import { useProfiles } from '@/lib/profiles/profiles';

/**
 * The round icon at the top right of the tab bar. It opens a small menu with the two places a viewer
 * can go: Profiles ("Who's watching?") and Language ("Choose your language"). Each entry is there only
 * when the CMS has that feature on, and says what is chosen now (the profile watching, the languages).
 * With neither on there is no icon.
 */

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    className="nav-menu-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
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

export function ProfileMenu() {
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
  const setOpen = (on: boolean) => setOpenOn(on ? pathname : null);
  const wrap = useRef<HTMLDivElement>(null);

  // Closes on a tap elsewhere, on Escape, and when the viewer has gone to another screen.
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
  if (entries.length === 0) return null;

  return (
    <div ref={wrap} style={{ position: 'relative', marginLeft: 'auto', flex: 'none' }}>
      <button
        type="button"
        className="nav-profile"
        style={{ marginLeft: 0, border: 0, cursor: 'pointer' }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={me ? `Profile: ${me.name}. Open menu` : 'Open profile menu'}
        onClick={() => setOpen(!open)}
      >
        {me ? me.name.charAt(0).toUpperCase() : <PersonIcon />}
      </button>
      {open && (
        <div
          role="menu"
          className="nav-menu-panel"
          style={{ left: 'auto', right: 0, borderRadius: 12, minWidth: 240, padding: '8px 0' }}
        >
          {entries.map((e) => (
            <button
              key={e.key}
              type="button"
              role="menuitem"
              className="nav-menu-item"
              aria-current={pathname.startsWith(e.to) ? 'page' : undefined}
              style={{
                border: 0,
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                padding: '12px 24px',
              }}
              onClick={() => navigate(e.to)}
            >
              {e.icon}
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span>{e.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7 }}>{e.value}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
