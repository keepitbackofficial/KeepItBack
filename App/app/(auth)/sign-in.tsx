import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { getSupabase } from '../../src/lib/supabase';
import { colors, radius, spacing, type } from '../../src/theme';

export default function SignIn() {
  const router = useRouter();
  const { shareUrl: shareUrlParam } = useLocalSearchParams<{ shareUrl?: string | string[] }>();
  const shareUrl = Array.isArray(shareUrlParam) ? shareUrlParam[0] : shareUrlParam;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'password' | 'email_code'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [formOpacity] = useState(() => new Animated.Value(0));
  const [formOffset] = useState(() => new Animated.Value(8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(formOffset, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    return () => { formOpacity.stopAnimation(); formOffset.stopAnimation(); };
  }, [formOffset, formOpacity, mode]);

  const onSignedIn = () => router.replace(shareUrl
    ? { pathname: '/save', params: { url: shareUrl, source: 'share_extension' } }
    : '/(tabs)/home');

  const signInWithPassword = async () => {
    if (busy) return;
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Check your connection and try again.');
    } finally { setBusy(false); }
  };

  const sendEmailCode = async () => {
    if (busy) return;
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: Linking.createURL('auth/callback') },
      });
      if (authError) { setError(authError.message); return; }
      setCode('');
      setMode('email_code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the email code. Try again.');
    } finally { setBusy(false); }
  };

  const verifyEmailCode = async () => {
    if (busy) return;
    if (!email.trim() || !code.trim()) { setError('Enter the code from your email.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (authError) { setError(authError.message); return; }
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify this code. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[type.display as any, { color: colors.text, textAlign: 'center' }]}>KeepItBack</Text>
        <Text style={[type.body as any, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }]}>Save anything. Find everything.</Text>

        <Animated.View style={{ marginTop: spacing.xxl * 1.2, gap: spacing.md, opacity: formOpacity, transform: [{ translateY: formOffset }] }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" style={styles.input} />
          {mode === 'password' ? <>
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry autoComplete="password" accessibilityLabel="Password" style={styles.input} />
            <Link href="/(auth)/forgot-password" style={styles.forgot}>Forgot password?</Link>
            <KIBButton label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void signInWithPassword()} disabled={busy} />
            <KIBButton label="Other ways to log in" variant="secondary" onPress={() => void sendEmailCode()} disabled={busy} />
          </> : <>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Enter the one-time code sent to {email}.</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="Email code" placeholderTextColor={colors.textMuted} keyboardType="number-pad" autoComplete="one-time-code" accessibilityLabel="Email sign-in code" style={styles.input} />
            <KIBButton label={busy ? 'Verifying…' : 'Verify and sign in'} onPress={() => void verifyEmailCode()} disabled={busy} />
            <KIBButton label="Back to password sign in" variant="ghost" onPress={() => { setError(null); setMode('password'); }} disabled={busy} />
          </>}
          {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
        </Animated.View>
      </View>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Don&apos;t have an account?{' '}<Link href={shareUrl ? { pathname: '/(auth)/sign-up', params: { shareUrl } } : '/(auth)/sign-up'} style={{ color: colors.accentSoft }}>Sign up</Link></Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: { height: 52, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.lg, fontSize: 15 },
  forgot: { color: colors.accent, textAlign: 'right', fontSize: 13 },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
});
