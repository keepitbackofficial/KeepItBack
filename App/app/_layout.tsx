import { Slot, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { setActiveUser } from '../src/lib/authState';
import { upsertProfile } from '../src/api/profile';
import { colors } from '../src/theme';
import { isValidUrl } from '../src/lib/platform';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import * as Network from 'expo-network';
import { useLibrary } from '../src/store/useLibrary';
import { recoverSyncingOperations } from '../src/lib/localStore';

/**
 * Keeps the current Supabase user available to data modules and upserts the
 * application profile once a real session exists. Idempotent.
 */
function AuthBridge() {
  const { isSignedIn, userId, isLoaded, user } = useAuth();

  useEffect(() => {
    setActiveUser(user ?? null);
  }, [user]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let active = true;
    const syncIfOnline = async () => {
      const state = await Network.getNetworkStateAsync().catch(() => null);
      if (active && state?.isConnected === true && state.isInternetReachable !== false) {
        await useLibrary.getState().loadItems();
      }
    };
    void (async () => {
      await recoverSyncingOperations(userId).catch(() => undefined);
      if (active) await syncIfOnline();
    })();
    const subscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected === true && state.isInternetReachable !== false) void syncIfOnline();
    });
    return () => { active = false; subscription.remove(); };
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    void (async () => {
      const name = typeof user?.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : undefined;
      const email = user?.email ?? undefined;
      await upsertProfile({ userId, name, email });
    })();
  }, [isLoaded, isSignedIn, user, userId]);

  return null;
}

/**
 * Extracts the first http(s) URL from shared text (Instagram posts share
 * caption + URL as plain text on Android).
 */
function extractSharedUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i)?.[0];
  if (!match) return null;
  const url = match.replace(/[),.;!?]+$/, '');
  return isValidUrl(url) ? url : null;
}

/**
 * Global share-intent consumer, mounted at the root so a share works from
 * any screen and on Android cold start (where an ACTION_SEND share never
 * produces a deep-link path). Signed-in users go straight to Save with the
 * auto-save flow; signed-out users land on sign-in which continues to Save
 * afterwards. Resetting the intent happens after navigation, and the guard
 * only clears when the intent has been consumed, so a re-delivered payload
 * cannot bounce the user back to home mid-save.
 */
function ShareIntentBridge() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { isReady, hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    if (error) {
      if (handled.current !== 'error') {
        handled.current = 'error';
        resetShareIntent();
        router.replace({ pathname: '/shareintent', params: { reason: 'parse' } });
      }
      return;
    }

    if (!hasShareIntent) {
      handled.current = null;
      return;
    }

    const key = `${shareIntent.webUrl ?? ''}|${shareIntent.text ?? ''}`;
    if (handled.current === key || !isLoaded) return;
    handled.current = key;

    const url = shareIntent.webUrl && isValidUrl(shareIntent.webUrl)
      ? shareIntent.webUrl
      : extractSharedUrl(shareIntent.text);

    if (!url) {
      resetShareIntent();
      router.replace({ pathname: '/shareintent', params: { reason: 'nolink' } });
      return;
    }

    if (isSignedIn) {
      router.replace({ pathname: '/save', params: { url, source: 'share_extension' } });
    } else {
      router.replace({ pathname: '/(auth)/sign-in', params: { shareUrl: url } });
    }
    resetShareIntent();
  }, [error, hasShareIntent, isLoaded, isReady, isSignedIn, resetShareIntent, router, shareIntent]);

  return null;
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </ShareIntentProvider>
  );
}

function RootContent() {
  const [fontsLoaded, fontError] = useFonts({
    KIBDisplay: PlayfairDisplay_500Medium,
    KIBDisplayStrong: PlayfairDisplay_600SemiBold,
    KIBBody: PlusJakartaSans_400Regular,
    KIBBodyMedium: PlusJakartaSans_600SemiBold,
    KIBBodyStrong: PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthBridge />
      <ShareIntentBridge />
      <Slot />
    </SafeAreaProvider>
  );
}
