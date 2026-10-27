import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchProfile, updateNotificationPreferences } from '../../src/api/profile';
import { NotificationPreferences } from '../../src/types';
import { colors, radius, spacing, type } from '../../src/theme';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { safeBack } from '../../src/lib/navigation';

const DEFAULTS: NotificationPreferences = { download_complete: true, sync_issues: true, shared_collection_updates: true };

export default function NotificationSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULTS);

  useEffect(() => {
    if (!userId) return;
    void fetchProfile(userId).then((result) => {
      const stored = result.data?.notification_preferences;
      if (stored) setPreferences({ ...DEFAULTS, ...stored });
    });
  }, [userId]);

  const update = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!userId) return;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const result = await updateNotificationPreferences(userId, next);
    if (result.error) {
      setPreferences(preferences);
      Alert.alert('Could not save preferences', result.error);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={[type.h2 as any, { color: colors.text }]}>Notifications</Text>
      <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Choose which app events may notify you.</Text>
      <Preference title="Download complete" detail="A local device notification when a direct media download finishes." value={preferences.download_complete} onChange={(value) => void update('download_complete', value)} />
      <Preference title="Sync issues" detail="Reserved for local retry and sync recovery notices." value={preferences.sync_issues} onChange={(value) => void update('sync_issues', value)} />
      <Preference title="Shared collection updates" detail="Push delivery needs server push credentials; this preference is saved for when delivery is configured." value={preferences.shared_collection_updates} onChange={(value) => void update('shared_collection_updates', value)} />
      <View style={{ marginTop: spacing.md }}><KIBButton label="Back" variant="ghost" onPress={() => safeBack(router, '/settings')} /></View>
    </View>
  );
}

function Preference({ title, detail, value, onChange }: { title: string; detail: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}><Text style={[type.label as any, { color: colors.text }]}>{title}</Text><Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{detail}</Text></View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.accentSoft }} thumbColor={value ? colors.accent : colors.surface} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md },
});
