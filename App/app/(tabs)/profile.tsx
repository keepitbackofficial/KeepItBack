import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '../../src/auth/AuthProvider';
import { fetchProfile } from '../../src/api/profile';
import { fetchConnectedAccounts } from '../../src/api/accounts';
import { KIBAvatar, KIBGroup, KIBListRow } from '../../src/components/KIBPrimitives';
import { KIBPlatformLogo } from '../../src/components/KIBPlatformLogo';
import { KIBKip } from '../../src/components/KIBKip';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, spacing, TAB_BAR_CLEARANCE, type } from '../../src/theme';

/**
 * SCREEN — PROFILE. Name/email come from the real Supabase user (or the
 * synced profile row); linked integrations only show connected state when
 * the connected_accounts table actually has a row.
 */
export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [dbProfileName, setDbProfileName] = useState<string | null>(null);
  const [igLinked, setIgLinked] = useState<'' | 'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    void (async () => {
      if (!user?.id) return;
      const res = await fetchProfile(user.id);
      if (res.data) setDbProfileName(res.data.display_name ?? null);
      const acc = await fetchConnectedAccounts();
      if (acc.data) setIgLinked(acc.data.some((a) => a.provider === 'instagram') ? 'yes' : 'no');
      else setIgLinked('checking');
    })();
  }, [user?.id]);

  const displayName = user?.fullName || dbProfileName || user?.emailAddresses[0]?.emailAddress.split('@')[0] || 'Your account';
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please check your connection and try again.';
      setSigningOut(false);
      Alert.alert('Could not sign out', message);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <View style={{ alignItems: 'center' }}>
        <View>
          <View style={styles.avatarRing}><KIBAvatar name={displayName} size={96} /></View>
          <KIBKip size={40} style={{ position: 'absolute', right: -38, bottom: -4 }} />
        </View>
        <Text style={[type.title, { color: colors.text, marginTop: spacing.lg, textAlign: 'center' }]}>{displayName}</Text>
        {email ? <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{email}</Text> : null}
      </View>

      <KIBGroup style={{ marginTop: spacing.xxl + 6 }}>
        <KIBListRow label="Connected accounts" icon="link" onPress={() => router.push('/settings/connected-accounts')} />
        <KIBListRow label="Settings" icon="sliders" onPress={() => router.push('/settings')} />
        <KIBListRow
          label="DM link"
          leading={<KIBPlatformLogo platform="Instagram" size={16} />}
          value={igLinked === 'yes' ? 'Linked' : igLinked === 'no' ? 'Not linked' : '…'}
          tone={igLinked === 'yes' ? 'ok' : 'muted'}
          onPress={() => router.push('/settings/connected-accounts')}
        />
      </KIBGroup>

      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => void handleSignOut()}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: signingOut }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.lg, opacity: signingOut ? 0.55 : 1 }}
      >
        <FontAwesomeFreeSolid name="arrow-right-from-bracket" size={15} color={colors.error} />
        <Text style={{ color: colors.error, textAlign: 'center', fontSize: 15, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  avatarRing: { borderRadius: 60, borderWidth: 6, borderColor: colors.surface },
});
