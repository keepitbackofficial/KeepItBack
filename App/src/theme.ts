/** KeepItBack website palette: blush ground, paper cards, ink actions, sky and rose accents. */
export const colors = {
  bg: '#F3E4E0',
  surface: '#FFFAF8',
  surface2: '#FAF0EC',
  surface3: '#EAD3CD',
  border: '#E8D6D1',
  text: '#1C1718',
  textSecondary: '#5A4B4D',
  textMuted: '#6E5E60',
  accent: '#1C1718',
  accentSoft: '#B5D2F1',
  accentTint: '#E3BFBA',
  sky: '#B5D2F1',
  rose: '#E3BFBA',
  paper: '#FFFAF8',
  success: '#2E6B4A',
  successTint: 'rgba(46,107,74,0.12)',
  warning: '#8A5A12',
  warningTint: '#FBE7C6',
  error: '#B42318',
  errorTint: 'rgba(180,35,24,0.08)',
  scrim: 'rgba(28,23,24,0.42)',
  white: '#FFFFFF',
};

export const radius = { sm: 10, md: 16, lg: 22, modal: 32, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

/** Room the floating tab bar needs below scrolling tab content. */
export const TAB_BAR_CLEARANCE = 112;

export const fontFamily = {
  display: 'KIBDisplay',
  displayStrong: 'KIBDisplayStrong',
  body: 'KIBBody',
  bodyMedium: 'KIBBodyMedium',
  bodyStrong: 'KIBBodyStrong',
};

export const type = {
  display: { fontFamily: fontFamily.displayStrong, fontSize: 36, lineHeight: 42, fontWeight: '600' as const },
  title: { fontFamily: fontFamily.displayStrong, fontSize: 30, lineHeight: 36, fontWeight: '600' as const },
  h1: { fontFamily: fontFamily.displayStrong, fontSize: 32, lineHeight: 38, fontWeight: '600' as const },
  h2: { fontFamily: fontFamily.displayStrong, fontSize: 28, lineHeight: 34, fontWeight: '600' as const },
  h3: { fontFamily: fontFamily.displayStrong, fontSize: 24, lineHeight: 30, fontWeight: '600' as const },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  secondary: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  caption: { fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  label: { fontFamily: fontFamily.bodyStrong, fontSize: 15, lineHeight: 20, fontWeight: '700' as const },
  overline: { fontFamily: fontFamily.bodyStrong, fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 0.5, textTransform: 'uppercase' as const },
};
