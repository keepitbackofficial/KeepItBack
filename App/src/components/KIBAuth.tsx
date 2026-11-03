import React, { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { FontAwesomeFreeBrands } from '@react-native-vector-icons/fontawesome-free-brands';
import { KIBKipScene } from './KIBKip';
import { KIBText as Text } from './KIBText';
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

/** "Continue with Google" — official mark plus a label, styled to the app's buttons. */
export function GoogleAuthButton({ label = 'Continue with Google', busy, onPress }: { label?: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={busy ? 'Working with Google…' : label}
      accessibilityState={{ disabled: Boolean(busy), busy: Boolean(busy) }}
      style={({ pressed }) => [googleStyles.button, { opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <FontAwesomeFreeBrands name="google" size={18} color={colors.text} />
      <Text style={googleStyles.label}>{busy ? 'Continuing…' : label}</Text>
    </Pressable>
  );
}

const googleStyles = StyleSheet.create({
  button: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(28,23,24,0.16)',
  },
  label: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bodyStrong, fontWeight: '700' },
});
