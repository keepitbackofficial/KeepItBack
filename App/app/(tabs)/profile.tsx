import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/expo';
import { fetchProfile } from '../../src/api/profile';
import { fetchConnectedAccounts } from '../../src/api/accounts';
import { KIBAvatar } from '../../src/components/KIBPrimitives';
import { colors, spacing, type } from '../../src/theme';

/**
 * SCREEN — PROFILE. Name/email come from the real Clerk user (or the
 * synced profile row); linked integrations only show connected state when
 * the connected_accounts table actually has a row.
 */
export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();
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
          label="Instagram DM link"
          value={igLinked === 'yes' ? 'Linked' : igLinked === 'no' ? 'Not linked' : '…'}
          onPress={() => router.push('/settings/connected-accounts')}
        />
      </View>

      <View style={{ flex: 1 }} />
      <Text
        onPress={() => void signOut()}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={{ color: colors.error, textAlign: 'center', fontSize: 15, padding: spacing.lg }}
      >
        Sign out
      </Text>
    </View>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.row}>
      <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{label}</Text>
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
