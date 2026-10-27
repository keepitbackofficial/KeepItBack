import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '../../src/auth/AuthProvider';
import { fetchProfile } from '../../src/api/profile';
import { fetchConnectedAccounts } from '../../src/api/accounts';
import { KIBAvatar } from '../../src/components/KIBPrimitives';
import { KIBPlatformLogo } from '../../src/components/KIBPlatformLogo';
import { colors, spacing, type } from '../../src/theme';

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
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={{ alignItems: 'center' }}>
        <KIBAvatar name={displayName} size={72} />
        <Text style={[type.h2 as any, { color: colors.text, marginTop: spacing.md }]}>{displayName}</Text>
        {email ? <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{email}</Text> : null}
      </View>

      <View style={{ marginTop: spacing.xxl, gap: 10 }}>
        <Row label="Connected accounts" value={'›'} onPress={() => router.push('/settings/connected-accounts')} />
        <Row label="Settings" value="›" onPress={() => router.push('/settings')} />
        <Row
          label="DM link"
          platform="Instagram"
          value={igLinked === 'yes' ? 'Linked' : igLinked === 'no' ? 'Not linked' : '…'}
          onPress={() => router.push('/settings/connected-accounts')}
        />
      </View>

      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => void handleSignOut()}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: signingOut }}
        style={{ alignItems: 'center', padding: spacing.lg, opacity: signingOut ? 0.55 : 1 }}
      >
        <Text style={{ color: colors.error, textAlign: 'center', fontSize: 15 }}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value, onPress, platform }: { label: string; value: string; onPress?: () => void; platform?: 'Instagram' }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={platform ? `${platform} ${label}` : label} style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
        {platform ? <KIBPlatformLogo platform={platform} size={16} /> : null}
        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{label}</Text>
      </View>
      <Text style={{ color: onValueColor(value), fontSize: 14 }}>{value}</Text>
    </Pressable>
  );
}

function onValueColor(v: string) {
  if (v === 'Linked') return colors.success;
  if (v === 'Not linked') return colors.textMuted;
  return colors.textMuted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
});
