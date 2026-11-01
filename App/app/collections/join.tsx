import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { acceptCollectionInvite } from '../../src/api/collections';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { KIBKipScene } from '../../src/components/KIBKip';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, spacing, type } from '../../src/theme';
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
      <View style={{ alignItems: 'center' }}>
        <KIBKipScene size={170} disc={colors.rose} badge={<FontAwesomeFreeSolid name="key" size={16} color={colors.text} />} />
      </View>
      <Text style={[type.h1, { color: colors.text, marginTop: spacing.md }]}>Join a collection</Text>
      <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 21 }}>Use the one-time code shared by the collection owner. Invite codes expire after seven days.</Text>
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
        <KIBButton label={busy ? 'Joining…' : 'Join collection'} style={{ height: 54 }} disabled={busy || activeCode.length !== 16} onPress={async () => {
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
  input: { marginTop: spacing.xl, height: 64, borderWidth: 1.5, borderColor: colors.text, borderRadius: 20, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: 19, letterSpacing: 3, textAlign: 'center', fontFamily: fontFamily.bodyStrong, fontWeight: '700' },
});
