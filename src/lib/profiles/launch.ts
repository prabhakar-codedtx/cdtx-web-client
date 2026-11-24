/** What the launch config says about profiles (`profileTypes`, `profilePicker`). Read defensively. */

export interface ProfileType {
  key: string;
  name: string;
  kind: string;
  /** Text for the badge on a tile (`KIDS`); null: none. */
  badge: string | null;
  colour: string | null;
  isDefault: boolean;
  kids: boolean;
  /** The type's tile (a Content Block resolved for this device): its size, corners and fill. */
  tile: {
    width: number;
    height: number;
    radii: [number, number, number, number];
    background: string | null;
  } | null;
}

export interface AddProfileSettings {
  enabled: boolean;
  label: string;
  maxProfiles: number;
  formTitle: string;
  typeQuestion: string;
}

export interface PickerSettings {
  title: string;
  background: string;
  titleColor: string;
  titleFont: { fontFamily?: string; fontSize?: number; fontWeight?: number; letterSpacing?: number } | null;
  gap: number;
  columns: number;
  addProfile: AddProfileSettings;
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function profileTypesOf(raw: Record<string, unknown> | undefined): ProfileType[] {
  const list = raw?.profileTypes;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const t = obj(item);
    const key = str(t.key);
    if (!key) return [];
    const p = obj(obj(t.card).presentation);
    const r = obj(p.cornerRadiiPx);
    const width = num(p.widthPx, 0);
    const height = num(p.heightPx, 0);
    return [
      {
        key,
        name: str(t.name) ?? key,
        kind: str(t.kind) ?? 'adult',
        badge: str(t.badge),
        colour: str(t.colour),
        isDefault: t.isDefault === true,
        kids: obj(t.badges).kidsProfile === true || t.kind === 'kids',
        tile:
          width > 0 && height > 0
            ? {
                width,
                height,
                radii: [
                  num(r.topLeft, 16),
                  num(r.topRight, 16),
                  num(r.bottomRight, 16),
                  num(r.bottomLeft, 16),
                ],
                background: str(p.backgroundColor),
              }
            : null,
      },
    ];
  });
}

/** The "Who's watching?" screen's settings; null when the server does not send them. */
export function pickerOf(raw: Record<string, unknown> | undefined): PickerSettings | null {
  const p = raw?.profilePicker;
  if (!p || typeof p !== 'object') return null;
  const s = obj(p);
  const a = obj(s.addProfile);
  const font = obj(s.titleText);
  return {
    title: str(s.title) ?? "Who's watching?",
    background: str(s.background) ?? '#0b0d12',
    titleColor: str(s.titleColor) ?? '#ffffff',
    titleFont: Object.keys(font).length ? font : null,
    gap: num(s.gap, 24),
    columns: num(s.columns, 0),
    // An older server (no "+" setting): no "+".
    addProfile: {
      enabled: a.enabled === true,
      label: str(a.label) ?? 'Add profile',
      maxProfiles: num(a.maxProfiles, 5),
      formTitle: str(a.formTitle) ?? 'Add profile',
      typeQuestion: str(a.typeQuestion) ?? 'Who is this profile for?',
    },
  };
}
