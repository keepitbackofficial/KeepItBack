import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBIconButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing } from '../../src/theme';

/** SCREEN 28 — PRIVACY. Private by default (PRD §33). */
export default function Privacy() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useStore();

  const Toggle = ({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surface2, true: colors.accent }}
        thumbColor="#fff"
        accessibilityLabel={label}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <Toggle label="Private profile" hint="Your library is only visible to you" value={settings.privateProfile} onChange={(v) => updateSettings({ privateProfile: v })} />
          <Toggle label="Public collections" hint="Allow sharing collections (coming soon)" value={settings.publicCollections} onChange={(v) => updateSettings({ publicCollections: v })} />
          <Toggle label="AI processing" hint="Generate summaries, keywords and categories" value={settings.aiProcessing} onChange={(v) => updateSettings({ aiProcessing: v })} />
          <Toggle label="Analytics consent" hint="Share anonymous usage events" value={settings.analyticsConsent} onChange={(v) => updateSettings({ analyticsConsent: v })} />
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.lg, lineHeight: 18 }}>
          What KeepItBack stores: saved links, metadata, notes and AI-derived keywords/summaries.
          URLs may be processed to generate AI metadata. Thumbnails are cached. Downloads are stored
          locally on your device. You can delete any item, collection, download or your entire
          account at any time.
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
