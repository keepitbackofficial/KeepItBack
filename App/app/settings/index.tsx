import { useRouter } from 'expo-router';
import { useState, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton, KIBIconButton } from '../../src/components/KIBPrimitives';
import { KIBModal } from '../../src/components/KIBContent';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

/** SCREEN 26 — SETTINGS. */
export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, resetDemoData } = useStore();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const Row = ({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
        {hint ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 16 }}>›</Text>
    </Pressable>
  );

  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <Section title="Account">
          <Row label="Edit Profile" onPress={() => router.push('/settings/edit-profile')} />
          <Row label="Account & Security" hint="Email, sessions, sign out all devices" onPress={() => router.push('/settings/account')} />
          <Row label="Privacy" hint="Private profile, AI processing, analytics" onPress={() => router.push('/settings/privacy')} />
        </Section>

        <Section title="App">
          <Row label="Notifications" onPress={() => router.push('/settings/notifications')} />
          <Row label="Appearance" hint="Dark theme (default)" onPress={() => {}} />
          <Row label="Storage" onPress={() => router.push('/downloads/storage')} />
        </Section>

        <Section title="Data">
          <Row label="Export Data" hint="Download a copy of your library" onPress={() => {}} />
          <Row label="Delete Account" onPress={() => router.push('/settings/account')} />
        </Section>

        <Section title="About">
          <View style={styles.row}>
            <Text style={{ color: colors.text, fontSize: 15 }}>Version</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>1.0.0</Text>
          </View>
        </Section>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <KIBButton label="Sign Out" variant="secondary" onPress={() => setSignOutOpen(true)} />
          <KIBButton label="Reset Demo Data" variant="ghost" onPress={resetDemoData} />
        </View>
      </ScrollView>

      <KIBModal visible={signOutOpen} onClose={() => setSignOutOpen(false)} title="Sign out?">
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          Your library stays synced to your account. You can sign back in anytime.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <KIBButton label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setSignOutOpen(false)} />
          <KIBButton
            label="Sign Out"
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => {
              setSignOutOpen(false);
              signOut();
              router.replace('/(auth)/sign-in');
            }}
          />
        </View>
      </KIBModal>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  group: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
