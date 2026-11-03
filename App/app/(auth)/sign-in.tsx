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

export default function SignIn() {
  const router = useRouter();
  const { shareUrl: shareUrlParam, notice: noticeParam } = useLocalSearchParams<{ shareUrl?: string | string[]; notice?: string | string[] }>();
  const shareUrl = Array.isArray(shareUrlParam) ? shareUrlParam[0] : shareUrlParam;
  const notice = Array.isArray(noticeParam) ? noticeParam[0] : noticeParam;
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

  const onSignedIn = useCallback(() => router.replace(shareUrl
    ? { pathname: '/save', params: { url: shareUrl, source: 'share_extension' } }
    : '/(tabs)/home'), [router, shareUrl]);

  // Google's PKCE exchange completes in /auth/callback when the deep link
  // wins the race; if it never routes, catch the session change here and
  // continue to the right place (V4 PRD §2.2 — the flow must complete).
  const googleNavigated = useRef(false);
  const { isSignedIn: isSignedInNow } = useAuth();
  useEffect(() => {
    if (!isSignedInNow || googleNavigated.current) return;
    if (pendingAuthTarget()) {
      // The /auth/callback route owns this handoff — but if it never mounts
      // (the browser completion won the race), never leave the user parked
      // on the login screen: navigate after a short grace period.
      const grace = setTimeout(() => { googleNavigated.current = true; onSignedIn(); }, 2500);
      return () => clearTimeout(grace);
    }
    googleNavigated.current = true;
    onSignedIn();
  }, [isSignedInNow, onSignedIn]);

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
        onSignedIn();
        return;
      }
      if (result.error && !result.dismissed) setError(result.error);
    } catch {
      setError('Could not start Google sign-in. Try again.');
    } finally { setBusy(false); }
  };

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
        <KIBAuthHero icon={mode === 'email_code' ? 'envelope' : undefined} />
        <Text style={[type.display, { color: colors.text, textAlign: 'center' }]}>KeepItBack</Text>
        <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>Save anything. Find everything.</Text>

        <Animated.View style={{ marginTop: spacing.xxl, gap: spacing.md, opacity: formOpacity, transform: [{ translateY: formOffset }] }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" style={styles.input} />
          {mode === 'password' ? <>
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry autoComplete="password" accessibilityLabel="Password" style={styles.input} />
            <Link href="/(auth)/forgot-password" style={styles.forgot}>Forgot password?</Link>
            <KIBButton label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void signInWithPassword()} disabled={busy} />
            <KIBButton label="Other ways to log in" variant="secondary" onPress={() => void sendEmailCode()} disabled={busy} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs }}>
              <View style={{ height: 1, backgroundColor: colors.border, flex: 1 }} />
                <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.bodyMedium }}>or</Text>
              <View style={{ height: 1, backgroundColor: colors.border, flex: 1 }} />
            </View>
            <GoogleAuthButton busy={busy} onPress={() => void continueWithGoogle()} />
          </> : <>
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Enter the one-time code sent to {email}.</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="Email code" placeholderTextColor={colors.textMuted} keyboardType="number-pad" autoComplete="one-time-code" accessibilityLabel="Email sign-in code" style={styles.input} />
            <KIBButton label={busy ? 'Verifying…' : 'Verify and sign in'} onPress={() => void verifyEmailCode()} disabled={busy} />
            <KIBButton label="Back to password sign in" variant="ghost" onPress={() => { setError(null); setMode('password'); }} disabled={busy} />
          </>}
          {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
          {notice ? <Text style={styles.noticeText} accessibilityLiveRegion="polite">{notice}</Text> : null}
        </Animated.View>
      </View>
      <Text style={authStyles.foot}>Don&apos;t have an account?{' '}<Link href={shareUrl ? { pathname: '/(auth)/sign-up', params: { shareUrl } } : '/(auth)/sign-up'} style={authStyles.link}>Sign up</Link></Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  noticeText: { color: colors.success, textAlign: 'center', fontSize: 13 },
  input: authStyles.input,
  forgot: { color: colors.text, textAlign: 'right', fontSize: 13, fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
});
