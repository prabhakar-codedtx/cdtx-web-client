import { useMemo, useState } from 'react';
import styled from 'styled-components';
import type { LanguageScreen as Screen, ScreenLanguage } from '@/lib/api/languageScreen';
import { languageTitle } from '@/lib/api/languageScreen';
import { useElementWidth } from '@/lib/device/useElementWidth';
import { CardView } from '@/render/CardView';

/**
 * "Choose your language": the first screen a new viewer sees. Everything about it comes from the
 * CMS (`GET /v1/launch/language-screen`): which languages, the words, one choice or several, the
 * layout, and the card each language is drawn with (a Content Block, or the built-in tile).
 */

const AUTO_COLUMNS: Record<string, number> = { tv: 4, web: 4, tablet: 3, mobile: 2 };
const GAP = 16;

const INK = {
  dark: {
    bg: '#0b0d14',
    text: '#ffffff',
    muted: 'rgba(255,255,255,0.65)',
    tile: '#1a1d29',
    edge: 'rgba(255,255,255,0.14)',
  },
  light: {
    bg: '#ffffff',
    text: '#111827',
    muted: 'rgba(17,24,39,0.62)',
    tile: '#f1f3f8',
    edge: 'rgba(17,24,39,0.14)',
  },
};
const ACCENT = '#ff7a00';

const Page = styled.main<{ $bg: string; $text: string; $image: string | null }>`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  box-sizing: border-box;
  color: ${(p) => p.$text};
  background: ${(p) => p.$bg} ${(p) => (p.$image ? `url("${p.$image}") center / cover no-repeat` : '')};
`;

const Panel = styled.div<{ $bg: string; $image: boolean }>`
  width: 100%;
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  text-align: center;
  /* A picture behind the screen is dimmed so the words stay readable. */
  ${(p) => (p.$image ? `background: ${p.$bg}b3; padding: 32px 16px; border-radius: 20px;` : '')}
`;

const Title = styled.h1`
  margin: 0;
  font-size: clamp(26px, 4vw, 44px);
  line-height: 1.15;
`;

const Sub = styled.p<{ $muted: string }>`
  margin: 8px 0 0;
  font-size: clamp(14px, 1.6vw, 20px);
  color: ${(p) => p.$muted};
`;

const Tick = styled.span`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${ACCENT};
  color: #fff;
  font-size: 15px;
  line-height: 24px;
  font-weight: 700;
`;

const Button = styled.button`
  min-width: 220px;
  height: 52px;
  padding: 0 36px;
  border: 0;
  border-radius: 26px;
  background: ${ACCENT};
  color: #fff;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const Skip = styled.button<{ $muted: string }>`
  border: 0;
  background: none;
  color: ${(p) => p.$muted};
  font-size: 15px;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
`;

const TileButton = styled.button<{ $on: boolean; $ink: (typeof INK)['dark'] }>`
  position: relative;
  display: block;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  border-radius: 14px;
  outline: ${(p) => (p.$on ? `3px solid ${ACCENT}` : '3px solid transparent')};
  outline-offset: 2px;
  &:focus-visible {
    outline-color: #4f8cff;
  }
`;

function hue(code: string): number {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** The picture of a tile, or a colour made from the language's code when it has none. */
function Pic({ lang, glyph }: { lang: ScreenLanguage; glyph: string }) {
  if (lang.imageUrl) {
    return (
      <img
        src={lang.imageUrl}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    );
  }
  const h = hue(lang.code);
  return (
    <span
      aria-hidden
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 38,
        fontWeight: 600,
        color: '#fff',
        background: `linear-gradient(135deg, hsl(${h} 65% 42%), hsl(${(h + 50) % 360} 70% 28%))`,
      }}
    >
      {glyph}
    </span>
  );
}

/**
 * The name a built-in tile shows: the language in its own script (தமிழ், తెలుగు). There is no English
 * name beside it; English shows only where the language has no name of its own (English itself).
 */
function names(lang: ScreenLanguage, s: Screen): { primary: string; secondary: string | null } {
  return { primary: s.showNativeName && lang.nativeName ? lang.nativeName : lang.name, secondary: null };
}

function BuiltInTile({
  lang,
  s,
  on,
  ink,
}: {
  lang: ScreenLanguage;
  s: Screen;
  on: boolean;
  ink: (typeof INK)['dark'];
}) {
  const { primary, secondary } = names(lang, s);
  const glyph = Array.from(primary)[0] ?? '';
  const text = (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        textAlign: s.tileShape === 'card' ? 'left' : 'inherit',
      }}
    >
      <strong
        style={{
          fontSize: 20,
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {primary}
      </strong>
      {secondary && <span style={{ fontSize: 13, opacity: 0.75 }}>{secondary}</span>}
    </span>
  );
  const border = `2px solid ${on ? ACCENT : ink.edge}`;
  if (s.tileShape === 'circle' && s.layout !== 'list') {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 8 }}>
        <span
          style={{
            position: 'relative',
            width: 120,
            height: 120,
            borderRadius: '50%',
            overflow: 'hidden',
            border,
          }}
        >
          {s.showPicture ? <Pic lang={lang} glyph={glyph} /> : null}
          {on && <Tick aria-hidden>✓</Tick>}
        </span>
        {text}
      </span>
    );
  }
  if (s.tileShape === 'pill' || s.layout === 'list') {
    return (
      <span
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 18px',
          background: ink.tile,
          border,
          borderRadius: s.tileShape === 'pill' ? 999 : 16,
          textAlign: 'left',
        }}
      >
        {s.showPicture && (
          <span style={{ width: 40, height: 40, flex: '0 0 auto', borderRadius: '50%', overflow: 'hidden' }}>
            <Pic lang={lang} glyph={glyph} />
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
        {on && <span style={{ color: ACCENT, fontWeight: 700 }}>✓</span>}
      </span>
    );
  }
  return (
    <span
      style={{
        position: 'relative',
        display: 'block',
        aspectRatio: '16 / 10',
        borderRadius: 14,
        overflow: 'hidden',
        border,
      }}
    >
      {s.showPicture ? (
        <Pic lang={lang} glyph={glyph} />
      ) : (
        <span style={{ display: 'block', height: '100%', background: ink.tile }} />
      )}
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 14,
          color: '#fff',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
        }}
      >
        {text}
      </span>
      {on && <Tick aria-hidden>✓</Tick>}
    </span>
  );
}

interface Props {
  screen: Screen;
  /** The languages picked (in screen order) and whether the viewer skipped. */
  onDone: (codes: string[], skipped: boolean) => void;
  /** The languages already chosen (the Language page): ticked to start with. */
  current?: string[];
  /** Given on the Language page, where there is nothing to skip: a way back, in place of Skip. */
  onCancel?: () => void;
  /** Room kept at the top for the tab bar when the screen is drawn under it. */
  offsetTop?: number;
}

export function LanguageScreen({ screen: s, onDone, current, onCancel, offsetTop = 0 }: Props) {
  const ink = INK[s.theme] ?? INK.dark;
  const byCode = useMemo(() => new Map(s.languages.map((l) => [l.code, l])), [s.languages]);
  const fallback = s.languages.find((l) => l.isDefault) ?? s.languages[0];
  const [picked, setPicked] = useState<string[]>(() => {
    const had = (current ?? []).filter((c) => s.languages.some((l) => l.code === c));
    if (had.length > 0) return s.selectMode === 'single' ? had.slice(0, 1) : had;
    return fallback ? [fallback.code] : [];
  });
  const [room, width] = useElementWidth<HTMLDivElement>();
  const single = s.selectMode === 'single';
  const block = s.card;

  const toggle = (code: string) => {
    setPicked((now) => {
      if (single) return [code];
      if (now.includes(code)) return now.filter((c) => c !== code);
      if (s.maxSelect !== null && now.length >= s.maxSelect) return now;
      return [...now, code];
    });
  };

  // Picked languages in the order the screen lists them, whatever order they were tapped in.
  const ordered = s.languages.filter((l) => picked.includes(l.code)).map((l) => l.code);
  const canContinue =
    ordered.length >= Math.max(single ? 1 : s.minSelect, 0) && (ordered.length > 0 || s.minSelect === 0);

  const columns = Math.max(1, Math.min(s.columns ?? AUTO_COLUMNS[s.device] ?? 4, s.languages.length));
  const across = s.layout === 'list' ? 1 : s.layout === 'chips' ? Math.min(4, s.languages.length) : columns;
  const cell = width > 0 ? Math.floor((width - GAP * (across - 1)) / across) : 0;
  const designedW = block?.card.width ?? 0;
  const designedH = block?.card.height ?? 0;
  // A grid fills its cell; a list or chips keep the card the size its designer gave it.
  const cardW = !block || cell <= 0 ? 0 : s.layout === 'grid' ? cell : Math.min(cell, designedW || cell);
  const cardH =
    block && designedW > 0 && designedH > 0
      ? Math.round((cardW * designedH) / designedW)
      : Math.round(cardW * 0.6);

  const finish = (skipped: boolean) => {
    const codes = skipped ? (fallback ? [fallback.code] : []) : ordered;
    onDone(
      codes.filter((c) => byCode.has(c)),
      skipped,
    );
  };

  return (
    <Page $bg={ink.bg} $text={ink.text} $image={s.backgroundUrl} style={{ paddingTop: 32 + offsetTop }}>
      <Panel $bg={ink.bg} $image={Boolean(s.backgroundUrl)}>
        <header>
          <Title>{s.title}</Title>
          {s.subtitle && <Sub $muted={ink.muted}>{s.subtitle}</Sub>}
        </header>

        <div ref={room} style={{ width: '100%', maxWidth: s.layout === 'list' ? 560 : 1000 }}>
          <div
            role={single ? 'radiogroup' : 'group'}
            aria-label={s.title}
            style={
              s.layout === 'chips'
                ? { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: GAP }
                : {
                    display: 'grid',
                    gap: GAP,
                    gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))`,
                    justifyItems: block ? 'center' : 'stretch',
                  }
            }
          >
            {s.languages.map((lang) => {
              const on = picked.includes(lang.code);
              return (
                <TileButton
                  key={lang.code}
                  type="button"
                  role={single ? 'radio' : 'checkbox'}
                  aria-checked={on}
                  aria-label={lang.name}
                  $on={on}
                  $ink={ink}
                  onClick={() => toggle(lang.code)}
                  style={
                    block && cardW > 0
                      ? { width: cardW, height: cardH }
                      : s.layout === 'chips'
                        ? undefined
                        : { width: '100%' }
                  }
                >
                  {block && cardW > 0 ? (
                    <>
                      {/* The card is a picture here: a tap anywhere on it picks the language. */}
                      <span style={{ pointerEvents: 'none', display: 'block' }}>
                        <CardView block={block} title={languageTitle(lang)} width={cardW} height={cardH} />
                      </span>
                      {on && <Tick aria-hidden>✓</Tick>}
                    </>
                  ) : (
                    <BuiltInTile lang={lang} s={s} on={on} ink={ink} />
                  )}
                </TileButton>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Button type="button" disabled={!canContinue} onClick={() => finish(false)}>
            {s.buttonLabel}
          </Button>
          {onCancel ? (
            <Skip type="button" $muted={ink.muted} onClick={onCancel}>
              Cancel
            </Skip>
          ) : (
            s.skippable && (
              <Skip type="button" $muted={ink.muted} onClick={() => finish(true)}>
                {s.skipLabel}
              </Skip>
            )
          )}
        </div>
      </Panel>
    </Page>
  );
}
