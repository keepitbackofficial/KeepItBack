import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acceptCollectionInvite } from '../../src/api/collections';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { colors, radius, spacing, type } from '../../src/theme';
import { safeBack } from '../../src/lib/navigation';

export default function JoinCollection() {
  const { code: inviteParam } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState(inviteParam ?? '');
  const [busy, setBusy] = useState(false);
  const activeCode = inviteParam ?? code;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={[type.h1 as any, { color: colors.text }]}>Join a collection</Text>
      <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Use the one-time code shared by the collection owner. Invite codes expire after seven days.</Text>
      <TextInput
        value={activeCode}
        onChangeText={(value) => setCode(value.toUpperCase().replace(/\s/g, ''))}
        placeholder="16-character invite code"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        accessibilityLabel="Collection invite code"
        style={styles.input}
      />
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <KIBButton label={busy ? 'Joining…' : 'Join collection'} disabled={busy || activeCode.length !== 16} onPress={async () => {
          setBusy(true);
          const result = await acceptCollectionInvite(activeCode);
          setBusy(false);
          if (result.error || !result.data) {
            Alert.alert('Invite could not be accepted', result.error ?? 'Check the code and try again.');
            return;
          }
          router.replace(`/collections/${result.data.collectionId}`);
        }} />
        <KIBButton label="Cancel" variant="ghost" onPress={() => safeBack(router, '/collections')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  input: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: 18, letterSpacing: 3 },
});
