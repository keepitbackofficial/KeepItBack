import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

/** Respects the system reduce-motion setting and follows changes to it. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduced;
}

type Mood = 'calm' | 'happy' | 'worried';

/**
 * Kip, the KeepItBack bookmark mascot, drawn with plain views so no SVG
 * dependency is needed. It blinks and bobs gently unless reduce motion is on.
 */
export function KIBKip({
  size = 64,
  mood = 'calm',
  animated = true,
  color = colors.text,
  style,
}: {
  size?: number;
  mood?: Mood;
  animated?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [blink] = useState(() => new Animated.Value(1));
  const [bob] = useState(() => new Animated.Value(0));
  const live = animated && !reduced;

  useEffect(() => {
    if (!live) return;
    const blinkLoop = Animated.loop(Animated.sequence([
      Animated.delay(2600),
      Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]));
    const bobLoop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    blinkLoop.start();
    bobLoop.start();
    return () => { blinkLoop.stop(); bobLoop.stop(); };
  }, [blink, bob, live]);

  const w = size;
  const bodyH = w * 1.02;
  const notch = w * 0.3;
  const eyeW = w * 0.27;
  const eyeH = w * 0.33;
  const pupil = w * 0.14;
  const stroke = Math.max(2, w * 0.07);

  const eye = (key: string) => mood === 'happy' ? (
    <View key={key} style={{ width: eyeW, height: eyeW / 2, borderTopLeftRadius: eyeW / 2, borderTopRightRadius: eyeW / 2, borderWidth: stroke, borderBottomWidth: 0, borderColor: colors.paper }} />
  ) : (
    <Animated.View key={key} style={{ width: eyeW, height: eyeH, borderRadius: eyeW, backgroundColor: colors.paper, transform: [{ scaleY: blink }] }}>
      <View style={{
        position: 'absolute',
        width: pupil,
        height: pupil,
        borderRadius: pupil / 2,
        backgroundColor: color,
        left: mood === 'worried' ? eyeW * 0.12 : eyeW * 0.36,
        top: mood === 'worried' ? eyeH * 0.5 : eyeH * 0.4,
      }} />
    </Animated.View>
  );

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: w, height: bodyH + notch, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -w * 0.05] }) }] }, style]}
    >
      <View style={{ width: w, height: bodyH, backgroundColor: color, borderTopLeftRadius: w * 0.16, borderTopRightRadius: w * 0.16, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: w * 0.1, marginTop: w * 0.24 }}>{[eye('l'), eye('r')]}</View>
        {mood === 'happy' ? (
          <View style={{ marginTop: w * 0.1, width: w * 0.24, height: w * 0.12, borderBottomLeftRadius: w * 0.12, borderBottomRightRadius: w * 0.12, borderWidth: stroke, borderTopWidth: 0, borderColor: colors.paper }} />
        ) : mood === 'worried' ? (
          <View style={{ marginTop: w * 0.12, width: w * 0.2, height: w * 0.08, borderTopLeftRadius: w * 0.1, borderTopRightRadius: w * 0.1, borderWidth: stroke, borderBottomWidth: 0, borderColor: colors.paper }} />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 0, height: 0, borderTopWidth: notch, borderTopColor: color, borderRightWidth: w / 2, borderRightColor: 'transparent' }} />
        <View style={{ width: 0, height: 0, borderTopWidth: notch, borderTopColor: color, borderLeftWidth: w / 2, borderLeftColor: 'transparent' }} />
      </View>
    </Animated.View>
  );
}

/** Kip on a soft colour disc, used by empty states. */
export function KIBKipScene({ size = 150, disc = colors.sky, mood = 'calm', badge }: { size?: number; disc?: string; mood?: Mood; badge?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [pop] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) { pop.setValue(1); return; }
    Animated.spring(pop, { toValue: 1, stiffness: 180, damping: 12, mass: 0.8, useNativeDriver: true }).start();
  }, [pop, reduced]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', width: size * 0.82, height: size * 0.82, borderRadius: size, backgroundColor: disc }} />
      <Animated.View style={{ transform: [{ scale: pop }], marginTop: size * 0.06 }}>
        <KIBKip size={size * 0.38} mood={mood} />
      </Animated.View>
      {badge ? (
        <View style={{ position: 'absolute', right: size * 0.04, top: size * 0.1, width: size * 0.26, height: size * 0.26, borderRadius: size, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.text }}>
          {badge}
        </View>
      ) : null}
    </View>
  );
}

const CONFETTI = [colors.text, colors.sky, colors.rose, colors.text, colors.sky, colors.rose, colors.paper];

/** One-shot burst of little ribbons; renders nothing until `play` becomes true. */
export function KIBConfetti({ play, count = 14, spread = 160 }: { play: boolean; count?: number; spread?: number }) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!play || reduced) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [play, progress, reduced]);
  if (!play || reduced) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = Math.PI * (0.08 + (0.84 * i) / (count - 1));
        const dx = -Math.cos(angle) * spread * (0.7 + 0.3 * ((i * 7) % 5) / 4);
        const dy = -Math.sin(angle) * spread * (0.6 + 0.4 * ((i * 3) % 4) / 3);
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: 9,
              height: 13,
              borderRadius: 2,
              backgroundColor: CONFETTI[i % CONFETTI.length],
              opacity: progress.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
                { translateY: progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, dy, dy + 30] }) },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i * 67) % 360 - 180}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
