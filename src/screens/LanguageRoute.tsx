import { Navigate, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useLanguageScreen } from '@/lib/api/languageScreen';
import { saveChoice, savedChoice } from '@/lib/language/choice';
import { LanguageScreen } from '@/screens/LanguageScreen';
import { NAV_HEIGHT } from '@/screens/navMetrics';

/**
 * `/language`: the language screen again, from the profile menu, with the viewer's languages ticked.
 * Continue keeps the new choice and starts over so every call is made in it; Cancel goes back. With
 * the screen off (or on a server that has none) there is nothing to change: back to the start.
 */
export function LanguageRoute() {
  const launch = useAppSelector((s) => s.launch.launch);
  const navigate = useNavigate();
  const { loading, screen } = useLanguageScreen(launch);
  if (loading) return <div>Loading…</div>;
  if (!screen) return <Navigate to="/" replace />;
  return (
    <LanguageScreen
      screen={screen}
      current={savedChoice()?.codes}
      offsetTop={NAV_HEIGHT}
      onCancel={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      onDone={(codes) => {
        saveChoice({ codes, skipped: false });
        window.location.assign('/');
      }}
    />
  );
}
