import React, { ComponentProps, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { KIBText as Text } from './KIBText';
import { useReducedMotion } from './KIBKip';
import { colors, fontFamily, radius } from '../theme';

type IconName = ComponentProps<typeof FontAwesomeFreeSolid>['name'];

const ICONS: Record<string, IconName> = {
  home: 'house',
  search: 'magnifying-glass',
  library: 'book',
  profile: 'user',
};

const LABEL_WIDTH = 56;

/**
 * Floating pill tab bar. The active tab gets a soft ink pill and its label
 * springs open; the centre + keeps opening the Save screen, as before.
 */
export function KIBTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const router = useRouter();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 10 }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          if (route.name === 'save-placeholder') {
            return (
              <Pressable
                key={route.key}
                onPress={() => router.push('/save')}
                accessibilityRole="button"
                accessibilityLabel="Save a link"
                style={({ pressed }) => [styles.item, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
              >
                <FontAwesomeFreeSolid name="plus" size={20} color={colors.textMuted} />
              </Pressable>
            );
          }
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });
          return (
            <TabItem key={route.key} icon={ICONS[route.name] ?? 'circle'} label={label} focused={focused} onPress={onPress} onLongPress={onLongPress} />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ icon, label, focused, onPress, onLongPress }: { icon: IconName; label: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const reduced = useReducedMotion();
  const [open] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    if (reduced) { open.setValue(focused ? 1 : 0); return; }
    Animated.spring(open, { toValue: focused ? 1 : 0, stiffness: 350, damping: 30, mass: 1, useNativeDriver: false }).start();
  }, [focused, open, reduced]);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={({ pressed }) => [
        styles.item,
        focused && styles.itemActive,
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
    >
      <FontAwesomeFreeSolid name={icon} size={19} color={focused ? colors.text : colors.textMuted} />
      <Animated.View
        style={{
          overflow: 'hidden',
          width: open.interpolate({ inputRange: [0, 1], outputRange: [0, LABEL_WIDTH] }),
          marginLeft: open.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }),
          opacity: open,
        }}
      >
        <Text numberOfLines={1} style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 56,
    padding: 8,
    minWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(28,23,24,0.10)',
    shadowColor: colors.text,
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  item: {
    height: 40,
    minWidth: 48,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: { backgroundColor: 'rgba(28,23,24,0.09)' },
  label: { color: colors.text, fontSize: 13, fontFamily: fontFamily.bodyStrong, fontWeight: '700' },
});
