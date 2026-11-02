import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { GoogleAuthButton, KIBAuthHero, authStyles } from '../../src/components/KIBAuth';
import { getSupabase } from '../../src/lib/supabase';
import { signInWithGoogle } from '../../src/api/googleAuth';
import { consumePendingAuthTarget, pendingAuthTarget } from '../../src/lib/authExchange';
import { colors, fontFamily, spacing, type } from '../../src/theme';

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
  const { isSignedIn } = useAuth();
  const googleNavigated = useRef(false);
  const [screenOpacity] = useState(() => new Animated.Value(0));
  const [screenOffset] = useState(() => new Animated.Value(8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(screenOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(screenOffset, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    return () => { screenOpacity.stopAnimation(); screenOffset.stopAnimation(); };
  }, [screenOffset, screenOpacity, verificationSent]);

  const continueToApp = useCallback(() => router.replace(shareUrl
    ? { pathname: '/save', params: { url: shareUrl, source: 'share_extension' } }
    : '/(tabs)/home'), [router, shareUrl]);

  // New-user Google sign-up completes the same way (V4 PRD §2.1/§2.2):
  // real accounts are created by Google OAuth through Supabase.
  useEffect(() => {
    if (!isSignedIn || googleNavigated.current) return;
    if (pendingAuthTarget()) {
      // The callback route owns this handoff — but if it never mounts
      // (the browser completion won the race), never leave the user parked
      // on the sign-up screen: navigate after a short grace period.
      const grace = setTimeout(() => { googleNavigated.current = true; continueToApp(); }, 2500);
      return () => clearTimeout(grace);
    }
    googleNavigated.current = true;
    continueToApp();
  }, [isSignedIn, continueToApp]);

  const continueWithGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithGoogle(shareUrl);
      if (result.ok) {
        // The browser completion is just as valid as the callback route's;
        // whichever wins, the signed-in user must land in the app.
        consumePendingAuthTarget();
        googleNavigated.current = true;
        continueToApp();
        return;
      }
      if (result.error && !result.dismissed) setError(result.error);
    } catch {
      setError('Could not start Google sign-in. Try again.');
    } finally { setBusy(false); }
  };

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
        <KIBAuthHero icon={verificationSent ? 'envelope' : 'user-plus'} disc={verificationSent ? colors.sky : colors.rose} size={150} />
        <Text style={[type.h1, { color: colors.text, textAlign: 'center' }]}>{verificationSent ? 'Verify your email' : 'Create account'}</Text>
        <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          {verificationSent ? `Enter the code sent to ${email}, or open the confirmation link on this device.` : 'A few details and your library is yours.'}
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {!verificationSent ? <>
            <TextInput value={name} onChangeText={setName} placeholder="Name (optional)" placeholderTextColor={colors.textMuted} autoComplete="name" accessibilityLabel="Name" style={styles.input} />
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" style={styles.input} />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password (at least 6 characters)" placeholderTextColor={colors.textMuted} secureTextEntry autoComplete="new-password" accessibilityLabel="Password" style={styles.input} />
            <KIBButton label={busy ? 'Creating…' : 'Create account'} onPress={() => void createAccount()} disabled={busy} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
              <View style={{ height: 1, backgroundColor: colors.border, flex: 1 }} />
              <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.bodyMedium }}>or</Text>
              <View style={{ height: 1, backgroundColor: colors.border, flex: 1 }} />
            </View>
            <GoogleAuthButton busy={busy} onPress={() => void continueWithGoogle()} />
          </> : <>
            <TextInput value={code} onChangeText={setCode} placeholder="Email verification code" placeholderTextColor={colors.textMuted} keyboardType="number-pad" autoComplete="one-time-code" accessibilityLabel="Email verification code" style={styles.input} />
            <KIBButton label={busy ? 'Verifying…' : 'Verify email'} onPress={() => void verifyEmail()} disabled={busy} />
            <KIBButton label={busy ? 'Sending…' : 'Resend email'} variant="secondary" onPress={() => void resendCode()} disabled={busy} />
          </>}
          {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
          {notice ? <Text style={styles.noticeText} accessibilityLiveRegion="polite">{notice}</Text> : null}
        </View>
      </Animated.View>
      <Text style={authStyles.foot}>Already have an account?{' '}<Link href={shareUrl ? { pathname: '/(auth)/sign-in', params: { shareUrl } } : '/(auth)/sign-in'} style={authStyles.link}>Sign in</Link></Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: authStyles.input,
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
  noticeText: { color: colors.success, fontSize: 13, textAlign: 'center' },
});
