import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { PRODUCT } from '@/lib/config';
import { NAV_HEIGHT } from '@/screens/navMetrics';

/**
 * The tab bar: the product's name, then the tabs the API lists (`title`, order, which is the default),
 * and a Back button on a title's page. It floats over the top of the screen (clear over a hero, solid
 * once the page scrolls). Its colours are the Design System's (`colors`): primary for the active tab,
 * the surface colours for the bar and the text colours for the labels.
 */
const CSS = `
.nav-tab { position: relative; display: inline-flex; align-items: center; height: 100%; padding: 0 2px;
  color: var(--nav-muted); text-decoration: none; font-size: 15px; font-weight: 500; white-space: nowrap;
  transition: color 0.15s ease; }
.nav-tab:hover { color: var(--nav-text); }
.nav-tab[aria-current="page"] { color: var(--nav-text); font-weight: 600; }
.nav-tab[aria-current="page"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: 14px;
  height: 3px; border-radius: 2px; background: var(--nav-primary); }
.nav-tab:focus-visible, .nav-back:focus-visible { outline: 2px solid var(--nav-primary); outline-offset: 4px; border-radius: 6px; }
.nav-back { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px;
  padding: 0; border: 0; border-radius: 50%; background: var(--nav-raised); color: var(--nav-text); cursor: pointer;
  transition: filter 0.12s ease, transform 0.12s ease; }
.nav-back:hover { filter: brightness(1.2); }
.nav-back:active { transform: scale(0.94); }
`;

export function TopNav() {
  const tabs = useAppSelector((s) => s.launch.tabs);
  const theme = useAppSelector((s) => s.launch.theme);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDetail = pathname.startsWith('/title/');
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The Design System's colours by key. Anything it does not list falls back to a neutral.
  const colors = useMemo(
    () => Object.fromEntries((theme?.colors ?? []).map((c) => [c.key, c.value])) as Record<string, string>,
    [theme],
  );
  const bg = colors['background'] ?? '#000000';
  const vars = {
    '--nav-primary': colors['primary'] ?? '#ffffff',
    '--nav-text': colors['text-primary'] ?? '#ffffff',
    '--nav-muted': colors['text-secondary'] ?? '#c3c8d4',
    '--nav-raised': colors['surface-raised'] ?? 'rgba(255,255,255,0.14)',
  } as React.CSSProperties;

  return (
    <nav
      aria-label="Tabs"
      style={{
        ...vars,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        height: NAV_HEIGHT,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '0 32px',
        overflowX: 'auto',
        background: solid ? bg : `linear-gradient(to bottom, ${bg}e6, ${bg}00)`,
        borderBottom: `1px solid ${solid ? (colors['border'] ?? 'transparent') : 'transparent'}`,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      <style>{CSS}</style>
      {onDetail && (
        <button type="button" className="nav-back" aria-label="Back" onClick={() => navigate(-1)}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      <span
        style={{
          color: 'var(--nav-primary)',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginRight: 8,
        }}
      >
        {PRODUCT}
      </span>
      {tabs.map((t) => (
        <NavLink key={t.slug} to={t.isDefault ? '/' : `/p/${t.slug}`} end className="nav-tab">
          {t.title ?? t.slug}
        </NavLink>
      ))}
    </nav>
  );
}
