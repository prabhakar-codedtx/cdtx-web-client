import { useEffect, useRef, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { DialogRoomContext } from '@/lib/device/dialogContext';
import { DetailScreen } from '@/screens/Routes';

/**
 * A title's details as a dialog over the screen the viewer was on (the rail's `tap.card.presentation`
 * is `dialog`). The screen behind stays drawn and keeps its place. Close (the button, Escape, or a tap
 * on the dark area) goes back one step in the history, which is that screen. A direct address or a
 * refresh has nothing behind it and shows the full page instead (`DetailRoute`).
 */
export function DetailDialog() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const match = matchPath('/title/:type/:id', pathname);
  // The panel is as tall as the window less its margins (4vh above and below).
  const [room, setRoom] = useState(() => Math.round(window.innerHeight * 0.92));
  useEffect(() => {
    const on = () => setRoom(Math.round(window.innerHeight * 0.92));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      opener?.focus?.();
    };
  }, [navigate]);

  // Another title opened from inside the dialog starts at its top.
  useEffect(() => {
    panel.current?.scrollTo(0, 0);
  }, [pathname]);

  if (!match) return null;
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) navigate(-1);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4vh 3vw',
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Details"
        tabIndex={-1}
        style={{
          position: 'relative',
          width: 'min(1100px, 100%)',
          maxHeight: '100%',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          borderRadius: 12,
          background: '#000',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          outline: 'none',
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => navigate(-1)}
          style={{
            position: 'sticky',
            top: 12,
            float: 'right',
            marginRight: 12,
            zIndex: 20,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontSize: 20,
            lineHeight: '36px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
        <DialogRoomContext.Provider value={{ height: room }}>
          <DetailScreen type={match.params.type} id={match.params.id} />
        </DialogRoomContext.Provider>
      </div>
    </div>
  );
}
