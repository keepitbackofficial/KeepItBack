import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../src/theme';

/**
 * SCREEN — SPLASH / SESSION RESTORATION. Clerk restores the real session
 * from secure storage before any routing decision is made.
 */
export default function Splash() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <Text style={[type.display as any, { color: colors.text, letterSpacing: 1 }]}>KEEPITBACK</Text>
        <Text style={[type.secondary as any, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Save anything.{'\n'}Find everything.
        </Text>
        <View style={{ marginTop: spacing.xxl }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[type.caption as any, { color: colors.textMuted, marginTop: spacing.sm }]}>restoring session…</Text>
        </View>
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
