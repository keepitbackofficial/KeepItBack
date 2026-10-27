import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { KIBText as Text } from '../../src/components/KIBText';
import { getSupabase } from '../../src/lib/supabase';
import { colors, spacing, type } from '../../src/theme';

function getAuthParams(rawUrl: string) {
  const parsed = new URL(rawUrl);
  const params = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  hashParams.forEach((value, key) => params.set(key, value));
  return params;
}

export default function AuthCallback() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const handleUrl = async (rawUrl: string | null) => {
      if (!rawUrl || started.current) return;
      started.current = true;
      try {
        const params = getAuthParams(rawUrl);
        const providerError = params.get('error_description') || params.get('error');
        if (providerError) throw new Error(providerError.replace(/\+/g, ' '));

        const code = params.get('code');
        const tokenHash = params.get('token_hash');
        const type = params.get('type');
        const flow = params.get('flow');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const supabase = getSupabase();

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if (tokenHash && (type === 'signup' || type === 'email' || type === 'recovery' || type === 'magiclink')) {
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (verifyError) throw verifyError;
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
        } else {
          throw new Error('This authentication link is incomplete or expired. Request a new email.');
        }

        if (!mounted) return;
        router.replace(type === 'recovery' || flow === 'recovery' ? '/(auth)/reset-password' : '/(tabs)/home');
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Could not complete this authentication link.');
      }
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    return () => { mounted = false; subscription.remove(); };
  }, [router]);

  return (
    <View style={styles.container}>
      {error ? <>
        <Text style={[type.h2 as any, { color: colors.text, textAlign: 'center' }]}>Link could not be used</Text>
        <Text style={{ color: colors.error, textAlign: 'center', marginTop: spacing.md }}>{error}</Text>
      </> : <>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Completing sign in…</Text>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
