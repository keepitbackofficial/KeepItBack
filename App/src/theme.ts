/**
 * KeepItBack design system — dark, premium, content-focused.
 * Source: App/KeepItBack_UI_Screens.md §1
 */
export const colors = {
  bg: '#0B0B0F',
  surface: '#15151B',
  surface2: '#1C1C24',
  border: '#292933',
  text: '#FFFFFF',
  textSecondary: '#A5A5B2',
  textMuted: '#6F6F7B',
  accent: '#7C5CFC',
  accentSoft: '#A78BFA',
  success: '#35D07F',
  warning: '#F5B942',
  error: '#FF5C67',
};

export const radius = { sm: 8, md: 12, lg: 16, modal: 24, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const type = {
  display: { fontSize: 32, fontWeight: '700' as const },
  h1: { fontSize: 26, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '600' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  secondary: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
};

/** Deterministic gradient pair for thumbnail placeholders, keyed by a string id. */
export const thumbnailPalettes: Array<[string, string]> = [
  ['#2B1E5A', '#7C5CFC'],
  ['#123B33', '#35D07F'],
  ['#4A2412', '#F5B942'],
  ['#3A1230', '#FF5C67'],
  ['#12294A', '#5B8DEF'],
  ['#3D1F4D', '#A78BFA'],
  ['#0E3A45', '#3EC1D3'],
];

export function paletteFor(key: string): [string, string] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return thumbnailPalettes[h % thumbnailPalettes.length];
}
