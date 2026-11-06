import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { path } from '@/lib/api/endpoints';
import { PRODUCT } from '@/lib/config';
import { NAV_HEIGHT } from '@/screens/navMetrics';
import { StyledNav } from '@/screens/StyledNav';

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
.nav-menu-btn { display: inline-flex; align-items: center; gap: 8px; padding: 6px 4px; border: 0; background: none;
  color: var(--nav-text); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
.nav-menu-btn:focus-visible { outline: 2px solid var(--nav-primary); outline-offset: 4px; border-radius: 6px; }
.nav-menu-chevron { transition: transform 0.15s ease; }
.nav-menu-btn[aria-expanded="true"] .nav-menu-chevron { transform: rotate(180deg); }
.nav-menu-panel { position: absolute; top: 100%; left: 0; min-width: 200px; padding: 8px 0 16px; display: flex;
  flex-direction: column; gap: 2px; background: var(--nav-panel); border-radius: 0 0 12px 12px; }
.nav-menu-item { display: flex; align-items: center; gap: 18px; padding: 12px 32px; color: var(--nav-muted);
  text-decoration: none; font-size: 16px; font-weight: 700; white-space: nowrap; }
.nav-menu-item:hover, .nav-menu-item:focus-visible { color: var(--nav-text); background: rgba(255,255,255,0.08); outline: none; }
.nav-menu-item[aria-current="page"] { color: var(--nav-text); }
.nav-menu-icon { width: 22px; height: 22px; flex: none; }
.nav-back { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px;
  padding: 0; border: 0; border-radius: 50%; background: var(--nav-raised); color: var(--nav-text); cursor: pointer;
  transition: filter 0.12s ease, transform 0.12s ease; }
.nav-back:hover { filter: brightness(1.2); }
.nav-back:active { transform: scale(0.94); }
`;

/** The tab bar: the CMS's design (`StyledNav`) when the server sends one, else the client's own. */
export function TopNav() {
  const style = useAppSelector((s) => s.launch.navStyle);
  const tabs = useAppSelector((s) => s.launch.tabs);
  const raw = useAppSelector((s) => s.launch.launch?.raw);
  if (style) {
    return (
      <StyledNav
        style={style}
        tabs={tabs}
        brandName={typeof raw?.productName === 'string' && raw.productName ? raw.productName : PRODUCT}
        brandImage={typeof raw?.productImage === 'string' && raw.productImage ? raw.productImage : null}
        iconTemplate={typeof raw?.iconFileURL === 'string' ? raw.iconFileURL : null}
      />
    );
  }
  return <ClientNav />;
}

/** The client's own tab bar, for a server that sends no design. */
function ClientNav() {
  const tabs = useAppSelector((s) => s.launch.tabs);
  const theme = useAppSelector((s) => s.launch.theme);
  // The product's brand from the CMS: its image, else its name (the key only before launch loads).
  const raw = useAppSelector((s) => s.launch.launch?.raw);
  const brandImage = typeof raw?.productImage === 'string' && raw.productImage ? raw.productImage : null;
  const brandName = typeof raw?.productName === 'string' && raw.productName ? raw.productName : PRODUCT;
  const [imageFailed, setImageFailed] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDetail = pathname.startsWith('/title/');
  const [solid, setSolid] = useState(false);
  // How the pages are drawn is the CMS's (`navStyle`): a row of tabs, or the current page with a list that opens.
  const dropdown = raw?.navStyle === 'dropdown';
  // Open for one address only: going to another page closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean | ((o: boolean) => boolean)) =>
    setOpenAt((cur) => ((typeof value === 'function' ? value(cur === pathname) : value) ? pathname : null));
  const menuRef = useRef<HTMLDivElement>(null);
  const iconTemplate = typeof raw?.iconFileURL === 'string' ? raw.iconFileURL : null;

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The list closes on Escape and on a click outside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenAt(null);
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenAt(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

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
    '--nav-panel': `${bg}f2`,
  } as React.CSSProperties;
  // A page's icon (`nav icon` in the CMS) as the product's icon file, painted in the text colour.
  const tint = (colors['text-primary'] ?? '#ffffff').replace('#', '').slice(0, 6);
  const iconSrc = (key: string | null): string | null =>
    key && iconTemplate
      ? `${path(iconTemplate.replace('{key}', encodeURIComponent(key)).replace('{fmt}', 'svg'))}?tint=${tint}`
      : null;
  // The page the viewer is on: the tab whose address this is (Home for the default).
  const current =
    tabs.find((t) => (t.isDefault ? pathname === '/' : pathname === `/p/${t.slug}`)) ??
    tabs.find((t) => t.isDefault) ??
    tabs[0];

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
        gap: dropdown ? 10 : 28,
        padding: '0 58px',
        // A row of tabs scrolls sideways; the dropdown's list hangs below the bar, so it must not be clipped.
        overflowX: dropdown ? 'visible' : 'auto',
        background: solid ? bg : `linear-gradient(to bottom, ${bg}e6, ${bg}00)`,
        // No line under the bar (not even a transparent one that turns dark on scroll).
        transition: 'background 0.2s ease',
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
      {brandImage && !imageFailed ? (
        <img
          src={brandImage}
          alt={brandName}
          onError={() => setImageFailed(true)}
          style={{ height: 24, maxWidth: 120, objectFit: 'contain', marginRight: 6 }}
        />
      ) : (
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
          {brandName}
        </span>
      )}
      {dropdown ? (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="nav-menu-btn"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {current?.title ?? current?.slug ?? ''}
            <svg
              className="nav-menu-chevron"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div className="nav-menu-panel" role="menu" aria-label="Pages">
              {tabs.map((t) => {
                const src = iconSrc(t.icon);
                return (
                  <NavLink
                    key={t.slug}
                    to={t.isDefault ? '/' : `/p/${t.slug}`}
                    end
                    role="menuitem"
                    className="nav-menu-item"
                    onClick={() => setOpen(false)}
                  >
                    {src ? <img className="nav-menu-icon" src={src} alt="" draggable={false} /> : null}
                    {t.title ?? t.slug}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        tabs.map((t) => (
          <NavLink key={t.slug} to={t.isDefault ? '/' : `/p/${t.slug}`} end className="nav-tab">
            {t.title ?? t.slug}
          </NavLink>
        ))
      )}
    </nav>
  );
}
