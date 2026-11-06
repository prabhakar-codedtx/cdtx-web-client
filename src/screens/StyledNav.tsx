import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { path } from '@/lib/api/endpoints';
import type { NavBarStyle, NavBarText, NavPage } from '@/lib/api/types';

/**
 * The tab bar as the CMS designed it (Design System → Navigation; `GET {tabsURL}` → `style`, for
 * this device): a top bar, a bottom bar, a left sidebar or a dropdown, with its own colours, sizes,
 * spacing and active-tab marker. Nothing here is a design value of the client's: every colour and
 * size is the server's. A sidebar or bottom bar keeps the page out from under it.
 */
const CASE: Record<NavBarStyle['textCase'], CSSProperties['textTransform']> = {
  none: 'none',
  upper: 'uppercase',
  lower: 'lowercase',
  capitalize: 'capitalize',
};

export function StyledNav({
  style,
  tabs,
  brandName,
  brandImage,
  iconTemplate,
}: {
  style: NavBarStyle;
  tabs: NavPage[];
  brandName: string;
  brandImage: string | null;
  /** `iconFileURL`: a tab's icon as the product's icon file, tinted per state. */
  iconTemplate: string | null;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDetail = pathname.startsWith('/title/');
  const side = style.placement === 'left';
  const bottom = style.placement === 'bottom';
  const dropdown = style.placement === 'dropdown';
  const collapsed = side && style.collapsed;
  const [imageFailed, setImageFailed] = useState(false);
  // Open for one address only: going to another page closes it without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean | ((o: boolean) => boolean)) =>
    setOpenAt((cur) => ((typeof value === 'function' ? value(cur === pathname) : value) ? pathname : null));
  const menuRef = useRef<HTMLDivElement>(null);

  // A sidebar or a bottom bar takes room from the page; a top bar floats over it (as before).
  useEffect(() => {
    const body = document.body.style;
    body.paddingLeft = side ? `${collapsed ? 96 : style.size}px` : '';
    body.paddingBottom = bottom ? `${style.size}px` : '';
    return () => {
      body.paddingLeft = '';
      body.paddingBottom = '';
    };
  }, [side, bottom, collapsed, style.size]);

  // The dropdown's list closes on Escape and a click outside.
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

  const to = (t: NavPage) => (t.isDefault ? '/' : `/p/${t.slug}`);
  const isCurrent = (t: NavPage) => (t.isDefault ? pathname === '/' : pathname === `/p/${t.slug}`);
  const current = tabs.find(isCurrent) ?? tabs.find((t) => t.isDefault) ?? tabs[0];
  const icon = (key: string | null, color: string | null): string | null =>
    key && iconTemplate
      ? `${path(iconTemplate.replace('{key}', encodeURIComponent(key)).replace('{fmt}', 'svg'))}?tint=${(
          color ?? '#ffffff'
        )
          .replace('#', '')
          .slice(0, 6)}`
      : null;

  const bar: CSSProperties = {
    position: 'fixed',
    zIndex: 5,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: side ? 'column' : 'row',
    alignItems: side ? 'stretch' : 'center',
    justifyContent: style.align === 'center' && !side ? 'center' : 'flex-start',
    gap: style.gap,
    padding:
      typeof style.padding === 'number'
        ? style.padding
        : `${style.padding.top}px ${style.padding.right}px ${style.padding.bottom}px ${style.padding.left}px`,
    background: style.background.gradient ?? style.background.color ?? 'transparent',
    ...(side
      ? { top: 0, bottom: 0, left: 0, width: collapsed ? 96 : style.size, overflowY: 'auto' }
      : bottom
        ? { left: 0, right: 0, bottom: 0, height: style.size }
        : { top: 0, left: 0, right: 0, height: style.size, overflowX: dropdown ? 'visible' : 'auto' }),
    ...(style.divider
      ? side
        ? { borderRight: '1px solid rgba(255,255,255,0.12)' }
        : bottom
          ? { borderTop: '1px solid rgba(255,255,255,0.12)' }
          : { borderBottom: '1px solid rgba(255,255,255,0.12)' }
      : {}),
  };

  const brand =
    style.logo && !bottom ? (
      brandImage && !imageFailed ? (
        <img
          src={brandImage}
          alt={brandName}
          onError={() => setImageFailed(true)}
          style={{
            height: 24,
            maxWidth: collapsed ? 40 : 120,
            objectFit: 'contain',
            marginRight: side ? 0 : 12,
          }}
        />
      ) : (
        <span
          style={{
            color: style.activeColor ?? '#ffffff',
            fontSize: 22,
            fontWeight: 800,
            marginRight: side ? 0 : 12,
            marginBottom: side ? 16 : 0,
          }}
        >
          {collapsed ? brandName.slice(0, 1) : brandName}
        </span>
      )
    ) : null;

  const back = onDetail ? (
    <button
      type="button"
      aria-label="Back"
      onClick={() => navigate(-1)}
      style={{
        width: 40,
        height: 40,
        border: 0,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)',
        color: style.activeColor ?? '#fff',
        cursor: 'pointer',
        flex: 'none',
      }}
    >
      ‹
    </button>
  ) : null;

  if (dropdown) {
    return (
      <nav aria-label="Tabs" style={bar}>
        {back}
        {brand}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            style={{ ...itemStyle(style, true, false), border: 0, cursor: 'pointer' }}
          >
            {current?.title ?? current?.slug ?? ''} ▾
          </button>
          {open && (
            <div
              role="menu"
              aria-label="Pages"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                minWidth: 220,
                display: 'flex',
                flexDirection: 'column',
                padding: 8,
                background: style.background.color ?? '#000',
                borderRadius: '0 0 12px 12px',
              }}
            >
              {tabs.map((t) => (
                <TabLink
                  key={t.slug}
                  tab={t}
                  to={to(t)}
                  style={style}
                  active={isCurrent(t)}
                  icon={icon}
                  role="menuitem"
                />
              ))}
            </div>
          )}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Tabs" style={bar}>
      {back}
      {brand}
      {tabs.map((t) => (
        <TabLink
          key={t.slug}
          tab={t}
          to={to(t)}
          style={style}
          active={isCurrent(t)}
          icon={icon}
          grow={style.align === 'spread' && !side}
          iconOnly={collapsed}
        />
      ))}
    </nav>
  );
}

function textOf(t: NavBarText | null): CSSProperties {
  return t
    ? {
        fontFamily: t.fontFamily ?? undefined,
        fontSize: t.fontSize ?? undefined,
        fontWeight: t.fontWeight ?? undefined,
        letterSpacing: t.letterSpacing ?? undefined,
      }
    : {};
}

/** One tab's look, plain or active: its text, colour and the active marker. */
function itemStyle(style: NavBarStyle, active: boolean, side: boolean): CSSProperties {
  const ink = (active ? style.activeColor : style.itemColor) ?? '#ffffff';
  const t = style.indicator.thickness;
  const mark = style.indicator.color ?? ink;
  const marker: CSSProperties = {};
  if (active) {
    if (style.indicator.type === 'underline') marker.boxShadow = `inset 0 -${t}px 0 ${mark}`;
    if (style.indicator.type === 'sidebar') marker.boxShadow = `inset ${t}px 0 0 ${mark}`;
    if (style.indicator.type === 'pill') Object.assign(marker, { background: mark, borderRadius: 999 });
    if (style.indicator.type === 'background')
      Object.assign(marker, {
        background: style.activeBackground ?? 'rgba(255,255,255,0.12)',
        borderRadius: 10,
      });
    if (style.activeBackground && style.indicator.type !== 'background' && style.indicator.type !== 'pill')
      Object.assign(marker, { background: style.activeBackground, borderRadius: 10 });
  }
  return {
    display: 'flex',
    flexDirection: style.itemLayout === 'iconAbove' ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: side ? 'flex-start' : 'center',
    gap: style.itemLayout === 'iconAbove' ? 4 : 10,
    padding: style.itemLayout === 'iconAbove' ? '6px 8px' : side ? '12px 16px' : '8px 12px',
    color: ink,
    background: 'none',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    textTransform: CASE[style.textCase],
    ...textOf(active ? (style.activeText ?? style.text) : style.text),
    ...marker,
  };
}

function TabLink({
  tab,
  to,
  style,
  active,
  icon,
  grow,
  iconOnly,
  role,
}: {
  tab: NavPage;
  to: string;
  style: NavBarStyle;
  active: boolean;
  icon: (key: string | null, color: string | null) => string | null;
  grow?: boolean;
  iconOnly?: boolean;
  role?: string;
}) {
  const layout = iconOnly ? 'icon' : style.itemLayout;
  const src = layout !== 'text' ? icon(tab.icon, active ? style.activeColor : style.itemColor) : null;
  const size = style.iconSize ?? 20;
  return (
    <NavLink
      to={to}
      end
      role={role}
      aria-label={iconOnly ? (tab.title ?? tab.slug) : undefined}
      style={{ ...itemStyle(style, active, style.placement === 'left'), flex: grow ? '1 1 0' : undefined }}
    >
      {src ? (
        <img src={src} alt="" width={size} height={size} draggable={false} />
      ) : layout === 'iconAbove' ? (
        // No icon on this tab: its space stays, so every label in the bar lines up.
        <span aria-hidden style={{ width: size, height: size }} />
      ) : null}
      {layout !== 'icon' && <span>{tab.title ?? tab.slug}</span>}
    </NavLink>
  );
}
