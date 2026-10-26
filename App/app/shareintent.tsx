import { useAuth } from '@clerk/expo';
import { useShareIntentContext } from 'expo-share-intent';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { KIBButton } from '../src/components/KIBPrimitives';
import { colors, spacing } from '../src/theme';
import { isValidUrl } from '../src/lib/platform';

function extractSharedUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (!match) return null;
  const url = match.replace(/[),.;!?]+$/, '');
  return isValidUrl(url) ? url : null;
}

export default function ShareIntentScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isReady, hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  const processed = useRef<string | null>(null);
  const url = shareIntent.webUrl && isValidUrl(shareIntent.webUrl)
    ? shareIntent.webUrl
    : extractSharedUrl(shareIntent.text);

  useEffect(() => {
    if (!isReady) return;

    if (!hasShareIntent) {
      router.replace('/');
      return;
    }
    if (!isLoaded || !url || processed.current === url) return;

    processed.current = url;
    resetShareIntent();
    if (isSignedIn) {
      router.replace({ pathname: '/save', params: { url, source: 'share_extension' } });
    } else {
      router.replace({ pathname: '/(auth)/sign-in', params: { shareUrl: url } });
    }
  }, [hasShareIntent, isLoaded, isReady, isSignedIn, resetShareIntent, router, url]);

  return (
    <View style={styles.container}>
      {!isReady || (hasShareIntent && !isLoaded && !!url) ? <ActivityIndicator color={colors.accent} /> : null}
      <Text style={styles.message}>
        {error ? `Could not read the shared link: ${error}` : hasShareIntent && !url ? 'No web link was found in the shared content.' : 'Opening shared link…'}
      </Text>
      {isReady && hasShareIntent && !url ? (
        <KIBButton label="Done" variant="secondary" onPress={() => { resetShareIntent(); router.replace('/'); }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  message: { color: colors.textSecondary, textAlign: 'center' },
});
