import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useDt } from '@/lib/device/useDt';
import { pickerOf, profileTypesOf, type ProfileType } from '@/lib/profiles/launch';
import {
  addProfile,
  chooseProfile,
  nameProblem,
  useProfiles,
  type LocalProfile,
} from '@/lib/profiles/profiles';

/**
 * "Who's watching?": one tile per profile made on this browser, then a "+" that adds one (when the
 * CMS has it on and the browser holds fewer than `maxProfiles`). Everything written or measured here
 * comes from the launch config: the title and colours (`profilePicker`), the kinds a profile can be
 * (`profileTypes`), the "+" label, limit and questions (`profilePicker.addProfile`).
 *
 * Choosing a profile, or adding one, reloads the app on its home screen: every page, rail and count
 * is then asked for as that kind of profile (`profileType`, added by `lib/api/client.ts`).
 */

const CSS = `
.pp { min-height: 100vh; box-sizing: border-box; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 40px; padding: 48px 24px; }
.pp-list { display: flex; flex-wrap: wrap; justify-content: center; margin: 0; padding: 0; list-style: none; }
.pp-tile { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 0; border: 0;
  background: none; color: #ccccd9; font: inherit; font-size: 15px; cursor: pointer; }
.pp-face { position: relative; display: flex; align-items: center; justify-content: center; overflow: visible;
  color: #fff; font-weight: 700; border: 3px solid transparent; box-sizing: border-box;
  transition: transform 0.15s ease, border-color 0.15s ease; }
.pp-tile:hover .pp-face, .pp-tile:focus-visible .pp-face { transform: scale(1.06); border-color: #fff; }
.pp-tile:hover, .pp-tile:focus-visible { color: #fff; outline: none; }
.pp-add .pp-face { border: 2px dashed #6b6b7a; background: transparent; color: #ccccd9; }
.pp-badge { position: absolute; top: -6px; right: -6px; padding: 2px 8px; border-radius: 6px;
  background: #f5b300; color: #111; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; }
.pp-overlay { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center;
  padding: 16px; background: rgba(0,0,0,0.7); }
.pp-dialog { width: min(520px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 28px;
  border-radius: 14px; background: #16181f; color: #fff; display: flex; flex-direction: column; gap: 20px; }
.pp-dialog h2 { margin: 0; font-size: 24px; }
.pp-field { display: flex; flex-direction: column; gap: 8px; border: 0; padding: 0; margin: 0; }
.pp-field > label, .pp-field > legend { font-size: 14px; color: #ccccd9; padding: 0; }
.pp-input { height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid #3a3d4a; background: #0b0d12;
  color: #fff; font: inherit; font-size: 16px; }
.pp-input:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pp-types { display: flex; flex-wrap: wrap; gap: 16px; }
.pp-type { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px; border-radius: 12px;
  border: 2px solid transparent; background: none; color: #ccccd9; font: inherit; cursor: pointer; }
.pp-type[aria-checked="true"] { border-color: #fff; color: #fff; }
.pp-type:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pp-error { margin: 0; color: #ff8a8a; font-size: 13px; }
.pp-actions { display: flex; justify-content: flex-end; gap: 12px; }
.pp-btn { height: 44px; padding: 0 22px; border-radius: 8px; border: 0; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
.pp-btn-primary { background: #fff; color: #111; }
.pp-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.pp-btn-ghost { background: #2a2d38; color: #fff; }
.pp-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (max-width: 600px) {
  .pp-overlay { padding: 0; align-items: flex-end; }
  .pp-dialog { width: 100%; border-radius: 16px 16px 0 0; }
}
`;

/** A tile's size on this device: the Content Block's, scaled down a little on a phone. */
function sizeOf(type: ProfileType | undefined, phone: boolean): { w: number; h: number; radius: string } {
  const t = type?.tile;
  const w0 = t?.width ?? 120;
  const h0 = t?.height ?? 120;
  const k = Math.min(1, (phone ? 110 : 220) / w0);
  const r = t?.radii ?? [16, 16, 16, 16];
  return {
    w: Math.round(w0 * k),
    h: Math.round(h0 * k),
    radius: r.map((x) => `${Math.round(x * k)}px`).join(' '),
  };
}

function Face({ type, name, phone }: { type: ProfileType | undefined; name: string; phone: boolean }) {
  const { w, h, radius } = sizeOf(type, phone);
  const style: CSSProperties = {
    width: w,
    height: h,
    borderRadius: radius,
    background: type?.tile?.background ?? type?.colour ?? '#26262e',
    fontSize: Math.round(h / 3),
  };
  return (
    <span className="pp-face" style={style} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
      {type?.kids && (
        <span className="pp-badge" style={type.colour ? { background: type.colour } : undefined}>
          {type.badge ?? 'KIDS'}
        </span>
      )}
    </span>
  );
}

export function ProfilePicker() {
  const raw = useAppSelector((s) => s.launch.launch?.raw);
  const phone = useDt() === 'mobile';
  const picker = useMemo(() => pickerOf(raw), [raw]);
  const types = useMemo(() => profileTypesOf(raw), [raw]);
  const { profiles } = useProfiles();
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  // The device can only show what the server sent: without profile kinds there is nothing to pick.
  if (!picker || types.length === 0) {
    return (
      <div role="status" style={{ padding: 48 }}>
        Profiles are not available right now.
      </div>
    );
  }

  const typeOf = (p: LocalProfile) => types.find((t) => t.key === p.type);
  const open = (id: string) => {
    chooseProfile(id);
    // Reload on the home screen: every call is then made as this kind of profile.
    window.location.assign('/');
  };
  const add = picker.addProfile;
  const canAdd = add.enabled && profiles.length < add.maxProfiles;
  const first = typeOf(profiles[0] ?? ({ type: types[0]!.key } as LocalProfile));
  const firstW = sizeOf(first, phone).w;
  const rowMax = picker.columns > 0 ? picker.columns * firstW + (picker.columns - 1) * picker.gap : undefined;
  const f = picker.titleFont;

  return (
    <div className="pp" style={{ background: picker.background }}>
      <style>{CSS}</style>
      <h1
        style={{
          margin: 0,
          color: picker.titleColor,
          textAlign: 'center',
          fontFamily: f?.fontFamily,
          fontSize: Math.min(f?.fontSize ?? 36, phone ? 28 : 72),
          fontWeight: f?.fontWeight ?? 700,
          letterSpacing: f?.letterSpacing,
        }}
      >
        {picker.title}
      </h1>
      <ul className="pp-list" aria-label="Profiles" style={{ gap: picker.gap, maxWidth: rowMax }}>
        {profiles.map((p) => (
          <li key={p.id}>
            <button type="button" className="pp-tile" onClick={() => open(p.id)} aria-label={p.name}>
              <Face type={typeOf(p)} name={p.name} phone={phone} />
              <span>{p.name}</span>
            </button>
          </li>
        ))}
        {canAdd && (
          <li>
            <button
              type="button"
              className="pp-tile pp-add"
              onClick={() => setAdding(true)}
              aria-label={add.label}
            >
              <span
                className="pp-face"
                style={{
                  width: sizeOf(first, phone).w,
                  height: sizeOf(first, phone).h,
                  borderRadius: sizeOf(first, phone).radius,
                  fontSize: 48,
                }}
                aria-hidden
              >
                +
              </span>
              <span>{add.label}</span>
            </button>
          </li>
        )}
      </ul>
      {profiles.length > 0 && (
        <button type="button" className="pp-btn pp-btn-ghost" onClick={() => navigate(-1)}>
          Back
        </button>
      )}
      {adding && (
        <AddProfileDialog
          title={add.formTitle}
          question={add.typeQuestion}
          types={types}
          existing={profiles}
          onCancel={() => setAdding(false)}
          onSaved={(p) => open(p.id)}
        />
      )}
    </div>
  );
}

/**
 * The screen the "+" opens: a name, then which kind of profile it is (one choice per profile type;
 * with only one the question is skipped). The default kind is chosen to start with. Save adds the
 * profile and opens it; Escape or Cancel adds nothing.
 */
function AddProfileDialog({
  title,
  question,
  types,
  existing,
  onCancel,
  onSaved,
}: {
  title: string;
  question: string;
  types: ProfileType[];
  existing: readonly LocalProfile[];
  onCancel: () => void;
  onSaved: (p: LocalProfile) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState((types.find((t) => t.isDefault) ?? types[0]!).key);
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const problem = nameProblem(name, existing);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const save = () => {
    setTouched(true);
    if (problem) return;
    const made = addProfile(name, type);
    if (made) onSaved(made);
  };

  return (
    <div className="pp-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form
        className="pp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-add-title"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 id="pp-add-title">{title}</h2>
        <div className="pp-field">
          <label htmlFor="pp-name">Name</label>
          <input
            id="pp-name"
            ref={input}
            className="pp-input"
            value={name}
            maxLength={20}
            autoComplete="off"
            aria-invalid={touched && !!problem}
            aria-describedby={touched && problem ? 'pp-name-error' : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {touched && problem && (
            <p id="pp-name-error" role="alert" className="pp-error">
              {problem}
            </p>
          )}
        </div>
        {types.length > 1 && (
          <fieldset className="pp-field">
            <legend>{question}</legend>
            <div className="pp-types" role="radiogroup" aria-label={question}>
              {types.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={type === t.key}
                  className="pp-type"
                  onClick={() => setType(t.key)}
                >
                  <Face type={t} name={t.name} phone />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="pp-actions">
          <button type="button" className="pp-btn pp-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="pp-btn pp-btn-primary" disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
