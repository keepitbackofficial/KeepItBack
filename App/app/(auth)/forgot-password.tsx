import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { getSupabase } from '../../src/lib/supabase';
import { colors, radius, spacing, type } from '../../src/theme';

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendRecovery = async () => {
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: authError } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${Linking.createURL('auth/callback')}?flow=recovery`,
      });
      if (authError) setError(authError.message);
      else setMessage('If an account exists for that address, a password reset email is on its way.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a reset email. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
        <Text style={[type.h1 as any, { color: colors.text, textAlign: 'center' }]}>Reset password</Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>We&apos;ll email you a link to choose a new password.</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Email" style={styles.input} />
        <KIBButton label={busy ? 'Sending…' : 'Send reset link'} onPress={() => void sendRecovery()} disabled={busy} />
        {message ? <Text style={styles.successText} accessibilityLiveRegion="polite">{message}</Text> : null}
        {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
      <Link href="/(auth)/sign-in" style={styles.link}>Back to sign in</Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: { height: 52, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.lg, fontSize: 15 },
  link: { color: colors.accent, textAlign: 'center' },
  successText: { color: colors.success, textAlign: 'center', fontSize: 13 },
  errorText: { color: colors.error, textAlign: 'center', fontSize: 13 },
});
