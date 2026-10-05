import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SCREEN 05 — SIGN IN.
 * Auth provider is behind this small adapter; swap `signIn` calls for
 * Clerk's useSignIn() flow per PRD §23. Mock auth signs in locally.
 */
export default function SignIn() {
  const router = useRouter();
  const signIn = useStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'buttons' | 'email'>('buttons');
  const insets = useSafeAreaInsets();

  const go = (_provider?: string) => {
    signIn(email || undefined);
    router.replace('/(tabs)/home');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[type.display as any, { color: colors.text, textAlign: 'center' }]}>KeepItBack</Text>
        <Text style={[type.body as any, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }]}>
          Your personal content library.
        </Text>

        <View style={{ marginTop: spacing.xxl * 1.5, gap: spacing.md }}>
          <KIBButton label="Continue with Google" icon="🌐" variant="secondary" onPress={() => go('google')} />
          <KIBButton label="Continue with Apple" icon="🍎" variant="secondary" onPress={() => go('apple')} />
          {mode === 'buttons' ? (
            <>
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>or</Text>
              <KIBButton label="Continue with Email" icon="✉️" variant="secondary" onPress={() => setMode('email')} />
            </>
          ) : (
            <View style={{ gap: spacing.md }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Email"
                style={styles.input}
              />
              <KIBButton label="Continue with Email" onPress={go} />
            </View>
          )}
        </View>
      </View>

      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
        Don't have an account?{' '}
        <Link href="/(auth)/sign-up" style={{ color: colors.accentSoft }}>
          Sign up
        </Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
  },
});
