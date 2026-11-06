import { useEffect, useRef, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { closeShare, showToast } from '@/app/uiSlice';
import { shareLink } from '@/lib/api/endpoints';

/** The places Share offers, in the order the CMS lists them (`shareTargets`); the default is these four. */
const DEFAULT_TARGETS = ['facebook', 'whatsapp', 'x', 'copy'];

interface Target {
  label: string;
  /** The brand's own glyph, drawn white on a dark circle (ZEE5's look). */
  icon: ReactNode;
  /** Where it opens (a new tab), or null: the link is copied. */
  href: (url: string, title: string) => string | null;
}

/**
 * The brand glyphs: Facebook, WhatsApp and X are the brands' own marks (from the open simple-icons set, CC0);
 * the link is the Feather "link" icon (MIT). Real artwork, drawn in the button's text colour.
 */
const ICONS: Record<'facebook' | 'whatsapp' | 'x' | 'link', ReactNode> = {
  facebook: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  ),
  link: (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
};

const enc = encodeURIComponent;
const TARGETS: Record<string, Target> = {
  facebook: {
    label: 'Facebook',
    icon: ICONS.facebook,
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: ICONS.whatsapp,
    href: (url, title) => `https://wa.me/?text=${enc(title ? `${title} ${url}` : url)}`,
  },
  x: {
    label: 'X',
    icon: ICONS.x,
    href: (url, title) => `https://x.com/intent/post?url=${enc(url)}${title ? `&text=${enc(title)}` : ''}`,
  },
  copy: { label: 'Copy link', icon: ICONS.link, href: () => null },
};

/** Copy a link: the clipboard when the page may use it, else through a hidden field. */
async function copy(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = url;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const done = document.execCommand('copy');
    field.remove();
    return done;
  }
}

/**
 * What the Share button opens: the title's link (`title.shareUrl`, finished by the server) sent to
 * Facebook, WhatsApp or X, or copied. Which of them show, and in what order, is the CMS's
 * (`shareTargets` in the launch config); one this client does not know is left out.
 */
export function ShareMenu() {
  const dispatch = useAppDispatch();
  const title = useAppSelector((s) => s.ui.share);
  const listed = useAppSelector((s) => s.launch.launch?.raw?.shareTargets);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!title) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeShare());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [title, dispatch]);

  const url = title ? shareLink(title) : null;
  if (!title || !url) return null;
  const keys = (Array.isArray(listed) ? listed : DEFAULT_TARGETS).filter(
    (k): k is string => typeof k === 'string' && k in TARGETS,
  );
  const name = title.title ?? '';

  const pick = async (key: string) => {
    const target = TARGETS[key]!;
    const href = target.href(url, name);
    dispatch(closeShare());
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    dispatch(showToast((await copy(url)) ? 'Link copied.' : url));
  };

  return (
    <div
      onClick={() => dispatch(closeShare())}
      style={{
        position: 'fixed',
        inset: 0,
        // Above the details dialog (1000), which a Share inside it opens over; below the toast (1100).
        zIndex: 1050,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${name}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1b1b22',
          color: '#fff',
          borderRadius: 12,
          padding: '20px 24px',
          minWidth: 300,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700 }}>Share</div>
        {name && <div style={{ fontSize: 13, opacity: 0.7, margin: '2px 0 16px' }}>{name}</div>}
        <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
          {keys.map((key, i) => {
            const t = TARGETS[key]!;
            return (
              <button
                key={key}
                ref={i === 0 ? first : undefined}
                type="button"
                onClick={() => void pick(key)}
                aria-label={t.label}
                style={{
                  background: 'none',
                  border: 0,
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  font: 'inherit',
                  fontSize: 12,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#333333',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
