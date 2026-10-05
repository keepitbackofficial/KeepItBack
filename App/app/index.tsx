import { Redirect, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../src/store/useStore';
import { colors, radius, spacing, type } from '../src/theme';

/** SCREEN 01 — SPLASH: check auth/local session, then route. */
export default function Splash() {
  const { hydrated, hasOnboarded, isSignedIn } = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  if (!hydrated || !ready) {
    return (
      <View style={styles.container}>
        <Text style={[type.display as any, { color: colors.text, letterSpacing: 1 }]}>KEEPITBACK</Text>
        <Text style={[type.secondary as any, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Save anything.{'\n'}Find everything.
        </Text>
        <View style={{ marginTop: spacing.xxl }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[type.caption as any, { color: colors.textMuted, marginTop: spacing.sm }]}>loading...</Text>
        </View>
      </View>
    );
  }
  if (!hasOnboarded) return <Redirect href="/(auth)/onboarding" />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
