import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { getSupabase } from '../../src/lib/supabase';
import { colors, radius, spacing, type } from '../../src/theme';

export default function ResetPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSupabase().auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) setError('This reset link is invalid or expired. Request a new one.');
    });
  }, []);

  const updatePassword = async () => {
    if (password.length < 6) { setError('Choose a password with at least 6 characters.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await getSupabase().auth.updateUser({ password });
      if (authError) { setError(authError.message); return; }
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
        <Text style={[type.h1 as any, { color: colors.text, textAlign: 'center' }]}>Choose a new password</Text>
        <TextInput value={password} onChangeText={setPassword} placeholder="New password" placeholderTextColor={colors.textMuted} secureTextEntry autoComplete="new-password" accessibilityLabel="New password" style={styles.input} />
        <KIBButton label={busy ? 'Saving…' : 'Update password'} onPress={() => void updatePassword()} disabled={busy || !ready} />
        {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: { height: 52, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.lg, fontSize: 15 },
  errorText: { color: colors.error, textAlign: 'center', fontSize: 13 },
});
