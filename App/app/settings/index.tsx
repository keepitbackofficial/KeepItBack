import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { isSupabaseConfigured } from '../../src/lib/supabase';
import { colors, radius, spacing, type } from '../../src/theme';

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
      contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: 60, paddingHorizontal: spacing.xl, gap: spacing.md }}
    >
      <Text style={[type.h3 as any, { color: colors.text }]}>Settings</Text>

      <Pressable onPress={() => router.push('/settings/connected-accounts')} accessibilityRole="button" style={styles.row}>
        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Connected accounts</Text>
        <Text style={{ color: colors.textMuted }}>›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/settings/notifications')} accessibilityRole="button" style={styles.row}>
        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Notifications</Text>
        <Text style={{ color: colors.textMuted }}>›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/downloads')} accessibilityRole="button" style={styles.row}>
        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Downloads & storage</Text>
        <Text style={{ color: colors.textMuted }}>›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/settings/privacy')} accessibilityRole="button" style={styles.row}>
        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Privacy & data</Text>
        <Text style={{ color: colors.textMuted }}>›</Text>
      </Pressable>

      <View style={styles.statusRow}>
        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Supabase</Text>
        <Text style={{ color: isSupabaseConfigured ? colors.success : colors.error, fontSize: 14 }}>
          {isSupabaseConfigured ? 'Configured' : 'Not configured'}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>Authentication</Text>
        <Text style={{ color: colors.success, fontSize: 14 }}>{userId ? 'Supabase active' : 'Signed out'}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          Alert.alert('Sign out', 'End this session on this device?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void performSignOut() },
          ])
        }
        style={styles.row}
      >
        <Text style={{ color: colors.error, fontSize: 15, flex: 1 }}>Sign out</Text>
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.md }}>
        KeepItBack saves references and metadata only. There is no hidden AI processing or paid service behind this app. Download availability is per-link and only where a permitted direct source exists.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
