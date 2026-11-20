import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Block, RailMotion, RailPopup, Title } from '@/lib/api/types';
import { CardView } from '@/render/CardView';
import { FOCUSABLE, popupPosition, popupSize, type Box } from './cardPopupGeometry';

const boxOf = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const cssEasing = (e?: number[] | null): string =>
  e && e.length === 4 ? `cubic-bezier(${e.join(',')})` : 'linear';

/**
 * The pop-up card of a rail (`CLIENT-MOTION-GUIDE.md` 6b): the pop-up design `blocks[popup.blockKey]` for the same
 * title, drawn in a layer above the page (a rail clips what it holds) so no card or row ever moves. It opens the way zee5.com
 * does: the box starts on the card and grows to the pop-up size. Closed by Escape, a scroll, a resize, leaving both it and the card, or one of its
 * buttons being used. Keyboard: Tab from the card goes into its buttons, Tab past the last one goes on to the next card.
 */
export function CardPopup({
  anchor,
  cardDesignWidth,
  spec,
  design,
  title,
  motion,
  onOpen,
  onAction,
  onEnter,
  onLeave,
  closing = false,
  exitMs = 0,
  onClose,
}: {
  /** The card the pointer (or focus) is on. */
  anchor: HTMLElement;
  /** The width the rail's own card was designed at, to read the rail's scale from the card on screen. */
  cardDesignWidth: number;
  spec: RailPopup;
  design: Block;
  title: Title;
  motion: RailMotion;
  /** The pop-up is the card grown: a click on it does what a click on the card does (open the title). */
  onOpen?: (title: Title) => void;
  onAction: (action: string, title: Title | null) => void;
  onEnter: () => void;
  onLeave: () => void;
  /** Closing: the opening plays backwards over `exitMs`, and the pop-up no longer takes the pointer. */
  closing?: boolean;
  exitMs?: number;
  onClose: (focusCard?: boolean | 'next') => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const open = shown && !closing;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fadeOnly = reduced && motion.reducedMotion !== 'full';

  const rect = anchor.getBoundingClientRect();
  const k = rect.width / Math.max(1, cardDesignWidth || rect.width);
  const size = popupSize(spec, { width: design.card.width ?? 0, height: design.card.height ?? 0 }, k);
  const bounds: Box = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const at = popupPosition(boxOf(rect), size, bounds, spec);
  const enter = Math.max(0, closing ? exitMs : (motion.timing?.durationMs ?? 0));
  // The look and the fades are the rail's JSON, (radius and shadow in screen px unless `scaleLook`); nothing here is the client's own.
  const fade = Math.max(0, spec.fadeMs ?? enter);
  const delay = Math.max(0, spec.contentDelayMs ?? 0);
  const lk = spec.scaleLook ? k : 1; // radius and shadow follow the card scale only when the JSON says so
  const fadeCurve = cssEasing(spec.fadeEasing);
  const shadow = spec.shadow
    ? `0 ${spec.shadow.y * lk}px ${spec.shadow.blur * lk}px 0 ${spec.shadow.color}`
    : 'none';
  const ease = cssEasing(motion.timing?.easing);
  // The card's own picture (its largest image): it grows with the opening and fades out as the pop-up's content
  // fades in, so the card seems to grow into the pop-up instead of a window opening over it.
  const poster = useMemo(() => {
    const area = (i: HTMLImageElement) => i.getBoundingClientRect().width * i.getBoundingClientRect().height;
    const best = [...anchor.querySelectorAll('img')].sort((a, b) => area(b) - area(a))[0];
    return best?.currentSrc || best?.src || null;
  }, [anchor]);

  useEffect(() => {
    const dismiss = () => onClose(false);
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  // Starts opening on the next frame (a timer backs the frame up where frames are held back, e.g. a hidden tab).
  useLayoutEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      setShown(true);
    };
    const id = window.requestAnimationFrame(go);
    const timer = window.setTimeout(go, 60);
    return () => {
      done = true;
      window.cancelAnimationFrame(id);
      window.clearTimeout(timer);
    };
  }, []);

  // Reduced motion set to "none": no pop-up at all ("fade" shows it without growing, "full" as normal).
  if (reduced && motion.reducedMotion === 'none') return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const items = [...(boxRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      onClose(true);
    } else if (!e.shiftKey && i === items.length - 1) {
      e.preventDefault();
      onClose('next');
    }
  };

  // zee5.com's method, with every value from the rail's JSON: the box starts exactly on the card and grows (left, top, width,
  // height) to the pop-up size over `timing`; the card's picture and the content cross-fade (`fadeMs`, `contentDelayMs`).
  const grown = open || fadeOnly;
  const t = `${enter}ms ${ease}`;
  const box = grown
    ? { left: at.left, top: at.top, width: size.width, height: size.height }
    : { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  return createPortal(
    <div
      ref={boxRef}
      data-card-popup=""
      role="group"
      aria-label={title.title ?? undefined}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed',
        ...box,
        zIndex: spec.layer ?? 0,
        borderRadius: (spec.radius ?? 0) * lk,
        overflow: 'hidden',
        pointerEvents: closing ? 'none' : undefined,
        willChange: 'left, top, width, height, box-shadow',
        contain: 'layout paint',
        boxShadow: grown ? shadow : 'none',
        background: spec.background ?? 'transparent',
        transition: `left ${t}, top ${t}, width ${t}, height ${t}, box-shadow ${t}`,
      }}
    >
      {/* The card's own picture (zee5's base-image): fills the box and fades out as the content fades in. */}
      {poster && !fadeOnly && (
        <img
          aria-hidden
          src={poster}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            opacity: grown ? 0 : 1,
            transition: `opacity ${fade}ms ${fadeCurve} ${delay}ms`,
          }}
        />
      )}
      {/* The pop-up's content at its final size, revealed by the growing box (never squashed). */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: size.width,
          height: size.height,
          opacity: grown ? 1 : 0,
          transition: fadeOnly ? 'none' : `opacity ${fade}ms ${fadeCurve} ${delay}ms`,
        }}
      >
        <CardView
          block={design}
          title={title}
          width={size.width}
          height={size.height}
          onOpen={
            onOpen
              ? (t2) => {
                  onClose(false);
                  onOpen(t2);
                }
              : undefined
          }
          onAction={(action, t2) => {
            onAction(action, t2);
            onClose(false);
          }}
          standalone
          priority="high"
        />
      </div>
    </div>,
    document.body,
  );
}
