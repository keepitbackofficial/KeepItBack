import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton, KIBIconButton } from '../../src/components/KIBPrimitives';
import { KIBModal } from '../../src/components/KIBContent';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

/** SCREEN 27 — ACCOUNT & SECURITY. Clerk operations are mocked here. */
export default function Account() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useStore();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const Row = ({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) => (
    <View style={styles.row}>
      <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{value}</Text>
      {onPress ? <Text style={{ color: colors.textMuted, fontSize: 16, marginLeft: 8 }}>›</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Account & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: spacing.xl, flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase' }}>Account</Text>
        <View style={styles.group}>
          <Row label="Email" value={profile.email} />
          <Row label="Connected accounts" value="Google" />
          <Row label="Password & passkeys" value="Managed by auth provider" />
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase', marginTop: spacing.lg }}>Sessions</Text>
        <View style={styles.group}>
          <Row label="Active sessions" value="This device" />
          <Row label="Sign out all devices" value="" />
        </View>

        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <KIBButton
            label="Sign out all devices"
            variant="secondary"
            onPress={() => {
              signOut();
              router.replace('/(auth)/sign-in');
            }}
          />
          <KIBButton label="Delete Account" variant="danger" onPress={() => setDeleteOpen(true)} />
        </View>
      </View>

      <KIBModal visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?">
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
          This permanently deletes your saved items, collections and settings, in line with the
          data-retention policy. This cannot be undone.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <KIBButton label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setDeleteOpen(false)} />
          <KIBButton
            label="Delete"
            variant="danger"
            style={{ flex: 1 }}
            onPress={() => {
              setDeleteOpen(false);
              Alert.alert('Account deletion', 'Account deletion is handled by the auth provider in production.');
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
