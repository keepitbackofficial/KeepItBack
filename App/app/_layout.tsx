import { Slot } from 'expo-router';
import { useEffect } from 'react';
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
import { ShareIntentProvider } from 'expo-share-intent';
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
      <Slot />
    </SafeAreaProvider>
  );
}
