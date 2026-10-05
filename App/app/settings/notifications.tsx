import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBIconButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing } from '../../src/theme';

/** SCREEN 29 — NOTIFICATIONS. All optional (PRD §32). */
export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useStore();

  const Toggle = ({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.surface2, true: colors.accent }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <Toggle label="Download completed" value={settings.notifDownload} onChange={(v) => updateSettings({ notifDownload: v })} />
          <Toggle label="AI processing completed" value={settings.notifAi} onChange={(v) => updateSettings({ notifAi: v })} />
          <Toggle label="Collection updates" value={settings.notifCollections} onChange={(v) => updateSettings({ notifCollections: v })} />
          <Toggle label="Product announcements" value={settings.notifAnnouncements} onChange={(v) => updateSettings({ notifAnnouncements: v })} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.lg }}>
          KeepItBack keeps notifications to a minimum.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  group: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
