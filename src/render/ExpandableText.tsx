import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * A text cut at its design's `maxLines` (with "…") that offers `moreLabel` when it really is cut;
 * pressed, the whole text shows and the box it sits in grows with it, and `lessLabel` cuts it again.
 * The press stays here: a card under it does not also open.
 */
export function ExpandableText({
  text,
  style,
  moreLabel,
  lessLabel,
  block = false,
}: {
  text: string;
  /** The text's look, cut included (`textCss`). */
  style: CSSProperties;
  moreLabel: string;
  lessLabel: string;
  /** Laid out as a block (a text atom) rather than inline (a layer of a box). */
  block?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  // Whether the cut hides anything: measured while cut, and again when the width changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, open, style]);

  const whole: CSSProperties = open
    ? { display: 'block', WebkitLineClamp: 'unset', overflow: 'visible', whiteSpace: 'normal', textOverflow: 'clip' }
    : {};
  return (
    <span style={{ display: block ? 'flex' : 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
      <span ref={ref} style={{ ...style, ...whole }}>
        {text}
      </span>
      {(cut || open) && (
        <button
          type="button"
          data-focus
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            marginTop: 2,
            color: style.color ?? 'inherit',
            font: 'inherit',
            fontSize: style.fontSize,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {open ? lessLabel : moreLabel}
        </button>
      )}
    </span>
  );
}
