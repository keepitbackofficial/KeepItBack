import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { getSupabase } from '../../src/lib/supabase';
import { colors, radius, spacing, type } from '../../src/theme';

export default function SignUp() {
  const router = useRouter();
  const { shareUrl: shareUrlParam } = useLocalSearchParams<{ shareUrl?: string | string[] }>();
  const shareUrl = Array.isArray(shareUrlParam) ? shareUrlParam[0] : shareUrlParam;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [screenOpacity] = useState(() => new Animated.Value(0));
  const [screenOffset] = useState(() => new Animated.Value(8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(screenOffset, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    return () => { screenOpacity.stopAnimation(); screenOffset.stopAnimation(); };
  }, [screenOffset, screenOpacity, verificationSent]);

  const continueToApp = () => router.replace(shareUrl
    ? { pathname: '/save', params: { url: shareUrl, source: 'share_extension' } }
    : '/(tabs)/home');

  const createAccount = async () => {
    if (busy) return;
    if (!email.trim() || !password) { setError('Enter your email and choose a password.'); return; }
    if (password.length < 6) { setError('Your password must be at least 6 characters.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { data, error: authError } = await getSupabase().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: name.trim() ? { full_name: name.trim() } : {},
          emailRedirectTo: Linking.createURL('auth/callback'),
        },
      });
      if (authError) { setError(authError.message); return; }
      if (data.session) continueToApp();
      else setVerificationSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account. Please try again.');
    } finally { setBusy(false); }
  };

  const verifyEmail = async () => {
    if (busy) return;
    if (!code.trim()) { setError('Enter the verification code from your email.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'signup' });
      if (authError) { setError(authError.message); return; }
      continueToApp();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify your email. Try again.');
    } finally { setBusy(false); }
  };

  const resendCode = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: Linking.createURL('auth/callback') } });
      if (authError) setError(authError.message);
      else setNotice('A new confirmation email was sent.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend the confirmation email.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Animated.View style={{ flex: 1, justifyContent: 'center', opacity: screenOpacity, transform: [{ translateY: screenOffset }] }}>
        <Text style={[type.h1 as any, { color: colors.text, textAlign: 'center' }]}>{verificationSent ? 'Verify your email' : 'Create account'}</Text>
        <Text style={[type.body as any, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          {verificationSent ? `Enter the code sent to ${email}, or open the confirmation link on this device.` : 'A few details and your library is yours.'}
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {!verificationSent ? <>
            <TextInput value={name} onChangeText={setName} placeholder="Name (optional)" placeholderTextColor={colors.textMuted} autoComplete="name" accessibilityLabel="Name" style={styles.input} />
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" style={styles.input} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password (at least 6 characters)" placeholderTextColor={colors.textMuted} secureTextEntry autoComplete="new-password" accessibilityLabel="Password" style={styles.input} />
            <KIBButton label={busy ? 'Creating…' : 'Create account'} onPress={() => void createAccount()} disabled={busy} />
          </> : <>
            <TextInput value={code} onChangeText={setCode} placeholder="Email verification code" placeholderTextColor={colors.textMuted} keyboardType="number-pad" autoComplete="one-time-code" accessibilityLabel="Email verification code" style={styles.input} />
            <KIBButton label={busy ? 'Verifying…' : 'Verify email'} onPress={() => void verifyEmail()} disabled={busy} />
            <KIBButton label={busy ? 'Sending…' : 'Resend email'} variant="secondary" onPress={() => void resendCode()} disabled={busy} />
          </>}
          {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
          {notice ? <Text style={styles.noticeText} accessibilityLiveRegion="polite">{notice}</Text> : null}
        </View>
      </Animated.View>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Already have an account?{' '}<Link href={shareUrl ? { pathname: '/(auth)/sign-in', params: { shareUrl } } : '/(auth)/sign-in'} style={{ color: colors.accentSoft }}>Sign in</Link></Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: { height: 52, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.lg, fontSize: 15 },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  noticeText: { color: colors.success, fontSize: 13, textAlign: 'center' },
});
