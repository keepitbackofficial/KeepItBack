import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../../src/store/useLibrary';
import { colors, radius, spacing, type } from '../../src/theme';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { safeBack } from '../../src/lib/navigation';

const EMOJIS = ['📁', '🏷️', '🎬', '🍳', '✈️', '💻', '💪', '💡', '🎧', '📚'];

export default function CreateCollection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const createCollection = useLibrary((s) => (s as any).createCollection) as any;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await createCollection({ name: name.trim(), emoji, description: description.trim() || undefined });
    setBusy(false);
    if (!res?.ok) {
      if (res?.duplicate) setError('You already have a collection with this name.');
      else setError(res?.error ?? 'Could not create the collection.');
      return;
    }
    safeBack(router, '/collections');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <Text style={[type.h3 as any, { color: colors.text }]}>New collection</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={colors.textMuted} accessibilityLabel="Collection name" style={styles.input} />
      <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} accessibilityLabel="Description" style={styles.input} />
      <Text style={{ color: colors.textMuted, marginTop: spacing.md, marginBottom: 6 }}>Pick an icon</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EMOJIS.map((e) => (
          <Text key={e} onPress={() => setEmoji(e)} style={[styles.emojiBtn, emoji === e && { borderColor: colors.accent }]}>
            {e}
          </Text>
        ))}
      </View>
      {error ? <Text style={{ color: colors.error, marginTop: spacing.md, fontSize: 13 }}>{error}</Text> : null}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <KIBButton label={busy ? 'Creating…' : 'Create'} onPress={submit} disabled={!name.trim() || busy} />
        <KIBButton label="Cancel" variant="ghost" onPress={() => safeBack(router, '/collections')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: {
    height: 52,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
  },
  emojiBtn: {
    fontSize: 24,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
});
