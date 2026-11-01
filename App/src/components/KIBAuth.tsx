import React, { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { KIBKipScene } from './KIBKip';
import { colors, fontFamily, radius, spacing } from '../theme';

/** Kip on a colour disc at the top of the sign-in screens, with an optional prop badge. */
export function KIBAuthHero({
  icon,
  disc = colors.sky,
  mood = 'calm',
  size = 170,
}: {
  icon?: ComponentProps<typeof FontAwesomeFreeSolid>['name'];
  disc?: string;
  mood?: 'calm' | 'happy' | 'worried';
  size?: number;
}) {
  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
      <KIBKipScene size={size} disc={disc} mood={mood} badge={icon ? <FontAwesomeFreeSolid name={icon} size={16} color={colors.text} /> : undefined} />
    </View>
  );
}

export const authStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: {
    height: 56,
    backgroundColor: colors.surface,
    borderColor: 'rgba(28,23,24,0.16)',
    borderWidth: 1.5,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    fontFamily: fontFamily.body,
  },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  noticeText: { color: colors.success, fontSize: 13, textAlign: 'center' },
  link: { color: colors.text, fontFamily: fontFamily.bodyStrong, fontWeight: '700' },
  foot: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
});
