import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { useReducedMotion } from './KIBKip';
import { colors } from '../theme';

/**
 * Collection membership marker: a plus that turns into an ink check with a
 * spring and a ripple ring when the item is added.
 */
export function CollectionCheck({ checked }: { checked: boolean }) {
  const reduced = useReducedMotion();
  const [on] = useState(() => new Animated.Value(checked ? 1 : 0));
  const [ring] = useState(() => new Animated.Value(0));
  const first = useRef(true);

  useEffect(() => {
    if (first.current || reduced) {
      first.current = false;
      on.setValue(checked ? 1 : 0);
      return;
    }
    Animated.spring(on, { toValue: checked ? 1 : 0, stiffness: 260, damping: 14, mass: 0.7, useNativeDriver: true }).start();
    if (checked) {
      ring.setValue(0);
      Animated.timing(ring, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [checked, on, reduced, ring]);

  return (
    <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: 32,
          height: 32,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: colors.text,
          opacity: ring.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.6, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
        }}
      />
      <View style={{ position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <FontAwesomeFreeSolid name="plus" size={13} color={colors.text} />
      </View>
      <Animated.View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', opacity: on, transform: [{ scale: on.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
        <FontAwesomeFreeSolid name="check" size={13} color={colors.paper} />
      </Animated.View>
    </View>
  );
}
