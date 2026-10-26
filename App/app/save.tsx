import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@clerk/expo';
import { KIBButton } from '../src/components/KIBPrimitives';
import { saveUrl } from '../src/api/items';
import { detectContentType, detectPlatform, isValidUrl, platformEmoji } from '../src/lib/platform';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * SCREEN — SAVE URL. One action: paste, hit save. The write goes to
 * Supabase and "Saved" appears only after the database confirms.
 * Duplicate detection is real (canonical URL unique per user).
 */
export default function SaveUrl() {
  const router = useRouter();
  const { url: sharedUrlParam, source: sourceParam } = useLocalSearchParams<{ url?: string | string[]; source?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const sharedUrl = Array.isArray(sharedUrlParam) ? sharedUrlParam[0] : sharedUrlParam;
  const source = sourceParam === 'share_extension' ? 'share_extension' : 'manual';
  const [url, setUrl] = useState(sharedUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoSaveStarted = useRef<string | null>(null);

  const trimmed = url.trim();
  const valid = isValidUrl(trimmed);
  const platform = valid ? detectPlatform(trimmed) : null;

  const doSave = useCallback(async (sharedValue?: string) => {
    const valueToSave = sharedValue?.trim() || trimmed;
    if (!isValidUrl(valueToSave) || busy) return;
    if (!userId) {
      setError('You are signed out. Sign in again and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await saveUrl(valueToSave, { userId, source });
    setBusy(false);

    if (!res.ok) {
      if ('error' in res) setError("KeepItBack couldn't recognize this link.");
      else {
        // Database said no — be honest, offer retry.
        setError(res.dbError);
        return;
      }
      return;
    }
    if (res.duplicate) {
      router.replace({ pathname: '/content/[id]', params: { id: res.item.id, duplicate: '1' } });
      return;
    }
    router.replace({ pathname: '/content/[id]', params: { id: res.item.id } });
  }, [busy, router, source, trimmed, userId]);

  useEffect(() => {
    if (source !== 'share_extension' || !sharedUrl || !userId || !isValidUrl(sharedUrl)) return;
    if (autoSaveStarted.current === sharedUrl) return;
    autoSaveStarted.current = sharedUrl;
    void doSave(sharedUrl);
  }, [doSave, sharedUrl, source, userId]);

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
      if (text.trim() && !isValidUrl(text)) setError('That doesn\u2019t look like a link — a full https:// URL works best.');
      else setError(null);
    }
  };

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
          placeholder="Paste a link here…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Link to save"
          style={styles.input}
        />
      </View>
      {error ? <Text style={{ color: colors.error, fontSize: 13, marginTop: 6 }}>{error}</Text> : null}

      <View style={{ marginTop: spacing.md, gap: spacing.md }}>
        <KIBButton label="📋 Paste from Clipboard" variant="secondary" onPress={pasteFromClipboard} />
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {platform ? (
          <View style={styles.preview}>
            <Text style={{ fontSize: 22, marginRight: 12 }}>{platformEmoji[platform]}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                {platform} {detectContentType(trimmed)}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                {trimmed}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={[type.caption as any, { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.md }]}>
          The platform and content type are detected from the URL itself.
        </Text>
        <KIBButton label={busy ? 'Saving…' : 'Save'} onPress={doSave} disabled={!valid || busy} />
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
