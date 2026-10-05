import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { KIBButton } from '../src/components/KIBPrimitives';
import { detectContentType, detectPlatform, isValidUrl, platformEmoji } from '../src/lib/platform';
import { useStore, SaveResult } from '../src/store/useStore';
import { SavedItem } from '../src/types';
import { colors, radius, spacing, type } from '../src/theme';

/** SCREEN 11/12 — SAVE URL + SAVE CONFIRMATION (one-tap save, spec §15). */
export default function SaveUrl() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const saveUrl = useStore((s) => s.saveUrl);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedItem | null>(null);
  const [wasDuplicate, setWasDuplicate] = useState(false);

  const doSave = (text: string, force = false) => {
    const result: SaveResult = saveUrl(text, { force });
    if (!result.ok) {
      setError("KeepItBack couldn't recognize this link.");
      return;
    }
    setWasDuplicate(result.duplicate);
    setSaved(result.item);
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
      setError(null);
      if (isValidUrl(text)) doSave(text);
      else setError("KeepItBack couldn't recognize this link.");
    }
  };

  if (saved) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <View style={styles.checkCircle}>
            <Text style={{ color: colors.success, fontSize: 40, fontWeight: '700' }}>✓</Text>
          </View>
          <Text style={[type.h2 as any, { color: colors.text, marginTop: spacing.lg, textAlign: 'center' }]}>
            {wasDuplicate ? 'Already Saved' : 'Saved to KeepItBack'}
          </Text>
          <Text style={[type.body as any, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]} numberOfLines={2}>
            {saved.title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
            {platformEmoji[saved.platform]} {saved.platform} {saved.contentType}
          </Text>

          {wasDuplicate ? (
            <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md }}>
              <KIBButton label="Open Saved Item" onPress={() => router.replace(`/content/${saved.id}`)} />
              <KIBButton label="Save Anyway" variant="secondary" onPress={() => { setSaved(null); doSave(saved.originalUrl, true); }} />
              <KIBButton label="Cancel" variant="ghost" onPress={() => router.back()} />
            </View>
          ) : (
            <View style={{ alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md }}>
              <KIBButton label="↓ Save to Device" variant="secondary" onPress={() => router.replace(`/content/${saved.id}`)} />
              <KIBButton label="Add to Collection" variant="secondary" onPress={() => router.replace(`/content/${saved.id}`)} />
              <KIBButton label="Done" onPress={() => router.back()} />
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Cancel save">
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>Save</Text>
      </View>

      <Text style={[type.h1 as any, { color: colors.text, marginTop: spacing.xl }]}>Save something</Text>

      <View style={[styles.inputWrap, error ? { borderColor: colors.error } : null]}>
        <TextInput
          value={url}
          onChangeText={(t) => {
            setUrl(t);
            setError(null);
          }}
          multiline
          placeholder="Paste a link here..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Link to save"
          style={styles.input}
        />
      </View>
      {error ? <Text style={{ color: colors.error, fontSize: 13, marginTop: 6 }}>{error}</Text> : null}

      <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg }}>or</Text>

      <View style={{ marginTop: spacing.md, gap: spacing.md }}>
        <KIBButton label="📋 Paste from Clipboard" variant="secondary" onPress={pasteFromClipboard} />
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {url.trim() && isValidUrl(url) ? (
          <View style={styles.preview}>
            <Text style={{ fontSize: 22, marginRight: 12 }}>{platformEmoji[detectPlatform(url)]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                {detectPlatform(url)} {detectContentType(url)}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                {url}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={[type.caption as any, { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.md }]}>
          KeepItBack will automatically detect the platform and content.
        </Text>
        <KIBButton label="Save" onPress={() => doSave(url)} disabled={!isValidUrl(url)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputWrap: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    minHeight: 96,
    padding: spacing.md,
  },
  input: { color: colors.text, fontSize: 15, padding: 0, textAlignVertical: 'top' },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(53,208,127,0.12)',
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
