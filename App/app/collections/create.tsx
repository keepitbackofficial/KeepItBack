import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

const EMOJIS = ['✈️', '💻', '🍔', '🛍️', '🏋️', '📚', '🎨', '🎵', '🏠', '💡'];

/** SCREEN 18 — CREATE COLLECTION (public option disabled until implemented). */
export default function CreateCollection() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addCollection = useStore((s) => s.addCollection);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('✈️');

  const create = () => {
    if (!name.trim()) return;
    addCollection({ name: name.trim(), emoji, description: description.trim() || undefined });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Cancel">
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Create</Text>
      </View>

      <Text style={[type.h1 as any, { color: colors.text, marginTop: spacing.xl }]}>New Collection</Text>

      <View style={styles.coverPreview}>
        <Text style={{ fontSize: 44 }}>{emoji}</Text>
      </View>

      <Text style={styles.label}>Emoji</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        {EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEmoji(e)}
            accessibilityRole="button"
            accessibilityLabel={`Emoji ${e}`}
            style={[styles.emojiChip, emoji === e && { borderColor: colors.accent, backgroundColor: 'rgba(124,92,252,0.15)' }]}
          >
            <Text style={{ fontSize: 18 }}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Collection name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Hyderabad Trip" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Collection name" />

      <Text style={styles.label}>Description</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Places and food to try..." placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Description" />

      <Text style={styles.label}>Privacy</Text>
      <View style={styles.privacyRow}>
        <Text style={{ color: colors.text, fontSize: 14 }}>🔒 Private</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, marginLeft: 12 }}>
          Public collections are coming soon — everything stays private for now.
        </Text>
      </View>

      <View style={{ flex: 1 }} />
      <KIBButton label="Create" onPress={create} disabled={!name.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  coverPreview: {
    height: 90,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  label: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.lg, marginBottom: 6 },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  emojiChip: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
