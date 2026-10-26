import { ClerkProvider , useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setTokenSource } from '../src/lib/clerkToken';
import { upsertProfile } from '../src/api/profile';
import { colors } from '../src/theme';
import { ShareIntentProvider } from 'expo-share-intent';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    'Missing Clerk publishable key. Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env, then restart Expo with a cleared cache.'
  );
}

function decodeJwtPayload(jwt: string): any | null {
  try {
    const [, payload] = jwt.split('.');
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')));
  } catch {
    return null;
  }
}

/**
 * Registers Clerk's token getter into the Supabase client and upserts the
 * application profile once a real session exists. Idempotent.
 */
function AuthBridge() {
  const { isSignedIn, getToken, userId, isLoaded } = useAuth();

  useEffect(() => {
    setTokenSource(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    void (async () => {
      let name: string | undefined;
      let email: string | undefined;
      try {
        const token = await getToken();
        const claims = token ? decodeJwtPayload(token) : null;
        if (claims) {
          name = claims.name || claims.given_name || claims.username;
          email = claims.email;
        }
      } catch {
        // Profile upsert below still proceeds with the user id alone.
      }
      await upsertProfile({ userId, name, email });
    })();
  }, [isLoaded, isSignedIn, userId]);

  return null;
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AuthBridge />
          <Slot />
        </SafeAreaProvider>
      </ClerkProvider>
    </ShareIntentProvider>
  );
}
