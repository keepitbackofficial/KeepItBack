import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { KIBText as Text } from './KIBText';
import { colors, fontFamily, radius, spacing, type } from '../theme';

/** Reusable KIB components — spec §53. */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function KIBMotionPressable({
  children,
  disabled,
  onPressIn,
  onPressOut,
  style,
  enter = false,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; enter?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(enter ? 0 : 1)).current;

  useEffect(() => {
    if (!enter) return;
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 220, delay: 20, useNativeDriver: true }).start();
    return () => entrance.stopAnimation();
  }, [enter, entrance]);

  const pressIn: PressableProps['onPressIn'] = (event) => {
    onPressIn?.(event);
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.975, stiffness: 300, damping: 18, mass: 0.7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.9, duration: 90, useNativeDriver: true }),
    ]).start();
  };
  const pressOut: PressableProps['onPressOut'] = (event) => {
    onPressOut?.(event);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, stiffness: 300, damping: 18, mass: 0.7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, {
        opacity: Animated.multiply(disabled ? 0.5 : opacity, entrance),
        transform: [
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          { scale },
        ],
      }]}
    >
      {children}
    </AnimatedPressable>
  );
}

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
    <KIBMotionPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {icon ? <Text style={{ fontSize: 16, marginRight: 6 }}>{icon}</Text> : null}
      <Text style={{ color: fg, fontSize: 14, fontFamily: fontFamily.bodyMedium, fontWeight: '600' }}>{label}</Text>
    </KIBMotionPressable>
  );
}

export function KIBIconButton({ icon, onPress, label, style }: { icon: string; onPress?: () => void; label: string; style?: ViewStyle }) {
  return (
    <KIBMotionPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.iconButton, style]}
    >
      <Text style={{ fontSize: 20, color: colors.accent }}>{icon}</Text>
    </KIBMotionPressable>
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
    <KIBMotionPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
    >
      {icon ? <Text style={{ fontSize: 13, marginRight: 4 }}>{icon}</Text> : null}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </KIBMotionPressable>
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
      <Text style={{ color: '#fff', fontFamily: fontFamily.bodyStrong, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
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

export function KIBErrorState({ onRetry, message }: { onRetry: () => void; message?: string | null }) {
  return (
    <KIBEmptyState emoji="⚠️" title="Something went wrong" message={message || "We couldn't load your library."} actionLabel="Retry" onAction={onRetry} />
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
        <Text style={{ color: colors.accent, fontFamily: fontFamily.bodyMedium, fontSize: 13 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
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
});
