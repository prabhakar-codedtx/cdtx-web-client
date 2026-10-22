import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { PRODUCT } from '@/lib/config';

/**
 * The tab bar, from the tabs the API lists (`name`, order, which is the default). The API sends no
 * look for it, so it has none of its own.
 */
export function TopNav() {
  const tabs = useAppSelector((s) => s.launch.tabs);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDetail = pathname.startsWith('/title/');
  return (
    <nav aria-label="Tabs">
      {onDetail && (
        <button type="button" onClick={() => navigate(-1)}>
          Back
        </button>
      )}
      <span>{PRODUCT}</span>
      {tabs.map((t) => (
        <NavLink key={t.slug} to={t.is_default ? '/' : `/p/${t.slug}`} end>
          {t.name}
        </NavLink>
      ))}
    </nav>
  );
}
