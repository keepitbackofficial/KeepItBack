/** Warm editorial design tokens from App/Ui Screens. */
export const colors = {
  bg: '#F3E4E0',
  surface: '#FFF8F8',
  surface2: '#FAF3F1',
  surface3: '#F1E6E7',
  border: '#E6D3CF',
  text: '#1C1718',
  textSecondary: '#635859',
  textMuted: '#786B6D',
  accent: '#8A4A3F',
  accentSoft: '#B46D60',
  accentTint: '#FFC8BD',
  success: '#286447',
  warning: '#8A5A1F',
  error: '#BA1A1A',
  white: '#FFFFFF',
};

export const radius = { sm: 8, md: 12, lg: 16, modal: 24, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const fontFamily = {
  display: 'KIBDisplay',
  displayStrong: 'KIBDisplayStrong',
  body: 'KIBBody',
  bodyMedium: 'KIBBodyMedium',
  bodyStrong: 'KIBBodyStrong',
};

export const type = {
  display: { fontFamily: fontFamily.display, fontSize: 36, lineHeight: 44, fontWeight: '500' as const },
  h1: { fontFamily: fontFamily.display, fontSize: 30, lineHeight: 38, fontWeight: '500' as const },
  h2: { fontFamily: fontFamily.displayStrong, fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
  h3: { fontFamily: fontFamily.displayStrong, fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 24, fontWeight: '400' as const },
  secondary: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 20, fontWeight: '400' as const },
  caption: { fontFamily: fontFamily.bodyMedium, fontSize: 11, lineHeight: 16, fontWeight: '600' as const },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 20, fontWeight: '600' as const },
};
