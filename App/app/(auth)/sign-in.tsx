import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignIn } from '@clerk/expo';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SCREEN — SIGN IN. Real Clerk email/password sign-in against the
 * configured Clerk instance (@clerk/expo v4 resource API). All error
 * text comes from actual Clerk responses; nothing is mocked.
 */
export default function SignIn() {
  const router = useRouter();
  const { shareUrl: shareUrlParam } = useLocalSearchParams<{ shareUrl?: string | string[] }>();
  const shareUrl = Array.isArray(shareUrlParam) ? shareUrlParam[0] : shareUrlParam;
  const { signIn, errors } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const readGlobalError = (): string | null => {
    const g = errors?.global?.[0] as any;
    if (g) return g.longMessage || g.message || null;
    return null;
  };

  const doSignIn = async () => {
    if (!signIn || busy) return;
    const emailAddress = email.trim();
    if (!emailAddress || !password) {
      setError('Enter your email address and password to sign in.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await signIn.password({ emailAddress, password });
      if (res.error) {
        setError(
          (res as any).error?.errors?.[0]?.longMessage ||
            res.error.message ||
            readGlobalError() ||
            'Sign-in failed. Check your details and try again.',
        );
        return;
      }
      if (signIn.status === 'complete') {
        const finalize = await signIn.finalize();
        if (finalize.error) {
          setError(finalize.error.message || 'Signed in, but could not activate your session. Try again.');
          return;
        }
        if (shareUrl) {
          router.replace({ pathname: '/save', params: { url: shareUrl, source: 'share_extension' } });
        }
      } else if (signIn.status === 'needs_second_factor') {
        setError('Two-factor is enabled on this account and isn\u2019t supported by this flow yet.');
      } else if (signIn.status === 'needs_identifier') {
        setError(
          'Clerk did not accept an email address for this sign-in. Confirm email sign-in is enabled for the Clerk app whose publishable key is configured, then restart Expo with a cleared cache.',
        );
      } else {
        setError(`Sign-in stopped at step "${signIn.status}".`);
      }
    } catch (e: any) {
      setError(
        e?.errors?.[0]?.longMessage ||
          e?.errors?.[0]?.message ||
          e?.message ||
          readGlobalError() ||
          'Sign-in failed. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[type.display as any, { color: colors.text, textAlign: 'center' }]}>KeepItBack</Text>
        <Text style={[type.body as any, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }]}>
          Save anything. Find everything.
        </Text>

        <View style={{ marginTop: spacing.xxl * 1.2, gap: spacing.md }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="Email"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoComplete="password"
            accessibilityLabel="Password"
            style={styles.input}
          />
          {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
          <KIBButton label={busy ? 'Signing in…' : 'Sign in'} onPress={doSignIn} disabled={busy} />
        </View>
      </View>

      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
        Don&apos;t have an account?{' '}
        <Link
          href={shareUrl ? { pathname: '/(auth)/sign-up', params: { shareUrl } } : '/(auth)/sign-up'}
          style={{ color: colors.accentSoft }}
        >
          Sign up
        </Link>
      </Text>
    </KeyboardAvoidingView>
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
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
});
