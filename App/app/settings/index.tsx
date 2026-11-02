import { Alert, ScrollView, StyleSheet } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { KIBGroup, KIBListRow } from '../../src/components/KIBPrimitives';
import { colors, spacing, type } from '../../src/theme';

/**
 * SCREEN — SETTINGS. Only entries that work end-to-end are listed. Every
 * integration state is reported honestly; nothing is toggled here that
 * isn't actually persisted.
 */
export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, userId } = useAuth();

  const performSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please check your connection and try again.';
      Alert.alert('Could not sign out', message);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 60, paddingHorizontal: spacing.xl, gap: spacing.lg }}
    >
      <Text style={[type.title, { color: colors.text }]}>Settings</Text>

      <KIBGroup>
        <KIBListRow label="Connected accounts" icon="link" onPress={() => router.push('/settings/connected-accounts')} />
        <KIBListRow label="Notifications" icon="bell" onPress={() => router.push('/settings/notifications')} />
        <KIBListRow label="Downloads & storage" icon="hard-drive" onPress={() => router.push('/downloads')} />
        <KIBListRow label="Privacy & data" icon="shield-halved" onPress={() => router.push('/settings/privacy')} />
      </KIBGroup>

      <KIBGroup>
        <KIBListRow label="Supabase" icon="cloud" value={isSupabaseConfigured ? 'Configured' : 'Not configured'} tone={isSupabaseConfigured ? 'ok' : 'error'} />
        <KIBListRow label="Authentication" icon="key" value={userId ? 'Supabase active' : 'Signed out'} tone="ok" />
      </KIBGroup>

      <KIBGroup>
        <KIBListRow
          label="Sign out"
          icon="arrow-right-from-bracket"
          danger
          chevron={false}
          onPress={() =>
            Alert.alert('Sign out', 'End this session on this device?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void performSignOut() },
            ])
          }
        />
      </KIBGroup>

      <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginHorizontal: spacing.xs }}>
        KeepItBack saves references and metadata only. There is no hidden AI processing or paid service behind this app. Download availability is per-link and only where a permitted direct source exists.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
