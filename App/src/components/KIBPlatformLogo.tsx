import React, { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { FontAwesomeFreeBrands } from '@react-native-vector-icons/fontawesome-free-brands';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { KIBText as Text } from './KIBText';
import { Platform, PlatformFilter } from '../types';
import { colors, radius, spacing } from '../theme';
import { platformColor } from '../lib/platform';
import { KIBMotionPressable } from './KIBPrimitives';

type BrandIconName = ComponentProps<typeof FontAwesomeFreeBrands>['name'];

const brandIcon: Partial<Record<Platform, BrandIconName>> = {
  Instagram: 'instagram',
  YouTube: 'youtube',
  TikTok: 'tiktok',
  Facebook: 'facebook',
  X: 'x-twitter',
  Pinterest: 'pinterest',
  Reddit: 'reddit-alien',
};

/** Platform brand mark, loaded dynamically so it also works in Expo Go. */
export function KIBPlatformLogo({ platform, size = 16, color }: { platform: Platform; size?: number; color?: string }) {
  const tint = color ?? platformColor[platform];
  const name = brandIcon[platform];
  if (name) return <FontAwesomeFreeBrands name={name} size={size} color={tint} accessibilityLabel={`${platform} logo`} />;
  return <FontAwesomeFreeSolid name="globe" size={size} color={tint} accessibilityLabel="Web link" />;
}

/** Compact platform selector; brand names remain available to accessibility services. */
export function KIBPlatformChip({
  platform,
  active,
  count,
  onPress,
}: {
  platform: PlatformFilter;
  active: boolean;
  count?: number;
  onPress: () => void;
}) {
  const isAll = platform === 'All';
  const label = count === undefined ? platform : `${platform}, ${count} saved items`;
  return (
    <KIBMotionPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.activeChip]}
    >
      {isAll ? (
        <Text style={[styles.allLabel, active && styles.activeText]}>{count === undefined ? 'All' : `All (${count})`}</Text>
      ) : (
        <>
          <KIBPlatformLogo platform={platform} size={16} color={active ? colors.white : undefined} />
          {count !== undefined ? <Text style={[styles.count, active && styles.activeText]}>{count}</Text> : null}
        </>
      )}
    </KIBMotionPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 40,
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  activeChip: { backgroundColor: colors.accent, borderColor: colors.accent },
  allLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  count: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  activeText: { color: colors.white },
});
