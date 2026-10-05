import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

/** Reusable KIB components — spec §53. */

export function KIBButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.error
        : variant === 'secondary'
          ? colors.surface2
          : 'transparent';
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? '#fff' : colors.text;
  const border = variant === 'ghost' || variant === 'secondary' ? colors.border : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {icon ? <Text style={{ fontSize: 16, marginRight: 6 }}>{icon}</Text> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function KIBIconButton({ icon, onPress, label, style }: { icon: string; onPress?: () => void; label: string; style?: ViewStyle }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Text style={{ fontSize: 20 }}>{icon}</Text>
    </Pressable>
  );
}

export function KIBTag({ label, onRemove, small }: { label: string; onRemove?: () => void; small?: boolean }) {
  return (
    <View style={[styles.tag, small && { paddingVertical: 2, paddingHorizontal: 8 }]}>
      <Text style={[styles.tagText, small && { fontSize: 11 }]} numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel={`Remove tag ${label}`}>
          <Text style={[styles.tagText, { marginLeft: 4, color: colors.textMuted }]}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function KIBFilterChip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      {icon ? <Text style={{ fontSize: 13, marginRight: 4 }}>{icon}</Text> : null}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function KIBAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      accessibilityLabel={`Profile avatar of ${name}`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function KIBSkeleton({ width, height, style }: { width: number | `${number}%`; height: number; style?: ViewStyle }) {
  return <View style={[{ width, height, borderRadius: radius.sm, backgroundColor: colors.surface2, overflow: 'hidden' }, style]} />;
}

export function KIBContentCardSkeleton() {
  return (
    <View style={[styles.card, { gap: spacing.sm }]}>
      <KIBSkeleton width="100%" height={110} />
      <KIBSkeleton width="80%" height={12} />
      <KIBSkeleton width="45%" height={10} />
    </View>
  );
}

export function KIBEmptyState({
  emoji,
  title,
  message,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 44, marginBottom: spacing.md }} accessibilityLabel={title}>
        {emoji}
      </Text>
      <Text style={[type.h3 as TextStyle, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.secondary as TextStyle, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, maxWidth: 260 }]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <KIBButton label={actionLabel} onPress={onAction} style={{ marginTop: spacing.xl }} />
      ) : null}
    </View>
  );
}

export function KIBErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <KIBEmptyState emoji="⚠️" title="Something went wrong" message="We couldn't load your library." actionLabel="Retry" onAction={onRetry} />
  );
}

export function ScreenHeader({
  title,
  left,
  right,
  subtitle,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>{left}</View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={[type.h3 as TextStyle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={[type.caption as TextStyle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 36, justifyContent: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
      <Text style={[type.h3 as TextStyle, { color: colors.text }]}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={{ color: colors.accentSoft, fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.offline}>
      <Text style={{ color: colors.warning, fontSize: 12 }}>⚠ You're offline — saves are queued for sync</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagText: { color: colors.textSecondary, fontSize: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  offline: {
    backgroundColor: '#2A2312',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
});
