import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibrary } from '../../src/store/useLibrary';
import { colors, fontFamily, spacing, type } from '../../src/theme';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { KIBKip } from '../../src/components/KIBKip';
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
      <View style={{ paddingRight: 64, marginBottom: spacing.md }}>
        <Text style={[type.title, { color: colors.text }]}>New collection</Text>
        <KIBKip size={40} style={{ position: 'absolute', right: 4, top: -8 }} />
      </View>
      <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={colors.textMuted} accessibilityLabel="Collection name" style={styles.input} />
      <TextInput value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} accessibilityLabel="Description" style={styles.input} />
      <Text style={[type.overline, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: 10 }]}>Pick an icon</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EMOJIS.map((e) => (
          <Text key={e} onPress={() => setEmoji(e)} accessibilityRole="button" accessibilityState={{ selected: emoji === e }} style={[styles.emojiBtn, emoji === e && { borderColor: colors.text, backgroundColor: colors.sky }]}>
            {e}
          </Text>
        ))}
      </View>
      {error ? <Text style={{ color: colors.error, marginTop: spacing.md, fontSize: 13 }}>{error}</Text> : null}
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <KIBButton label={busy ? 'Creating…' : 'Create'} onPress={submit} disabled={!name.trim() || busy} style={{ height: 54 }} />
        <KIBButton label="Cancel" variant="ghost" onPress={() => safeBack(router, '/collections')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  input: {
    height: 54,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderColor: 'rgba(28,23,24,0.12)',
    borderWidth: 1.5,
    borderRadius: 18,
    color: colors.text,
    paddingHorizontal: 18,
    fontSize: 15,
    fontFamily: fontFamily.body,
  },
  emojiBtn: {
    width: 58,
    height: 58,
    lineHeight: 56,
    textAlign: 'center',
    fontSize: 25,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
});
