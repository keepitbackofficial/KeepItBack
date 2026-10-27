import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../src/components/KIBText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../src/auth/AuthProvider';
import { KIBButton } from '../src/components/KIBPrimitives';
import { KIBPlatformLogo } from '../src/components/KIBPlatformLogo';
import { saveUrl } from '../src/api/items';
import { fetchLinkMetadata } from '../src/api/linkMetadata';
import type { LinkMetadata } from '../src/api/linkMetadata';
import { logProductEvent } from '../src/api/analytics';
import { useLibrary } from '../src/store/useLibrary';
import { detectContentType, detectPlatform, isValidUrl } from '../src/lib/platform';
import { colors, radius, spacing, type } from '../src/theme';
import { safeBack } from '../src/lib/navigation';

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
  const [previewMetadata, setPreviewMetadata] = useState<LinkMetadata | null>(null);
  const [metadataForUrl, setMetadataForUrl] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const autoSaveStarted = useRef<string | null>(null);

  const trimmed = url.trim();
  const valid = isValidUrl(trimmed);
  const platform = valid ? detectPlatform(trimmed) : null;
  const shownMetadata = metadataForUrl === trimmed ? previewMetadata : null;

  useEffect(() => {
    if (!valid || !userId) return;
    const candidateUrl = trimmed;
    let cancelled = false;
    const timer = setTimeout(() => {
      setMetadataLoading(true);
      void fetchLinkMetadata(candidateUrl).then((metadata) => {
        if (cancelled) return;
        setPreviewMetadata(metadata);
        setMetadataForUrl(candidateUrl);
        setMetadataLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setPreviewMetadata(null);
        setMetadataForUrl(candidateUrl);
        setMetadataLoading(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, userId, valid]);

  const doSave = useCallback(async (sharedValue?: string) => {
    const valueToSave = sharedValue?.trim() || trimmed;
    if (!isValidUrl(valueToSave) || busy) return;
    if (!userId) {
      setError('You are signed out. Sign in again and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    const metadata = metadataForUrl === valueToSave ? previewMetadata : await fetchLinkMetadata(valueToSave);
    const res = await saveUrl(valueToSave, { userId, source, metadata });
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
      void useLibrary.getState().loadItems({ force: true });
      router.replace({ pathname: '/content/[id]', params: { id: res.item.id, duplicate: '1' } });
      return;
    }
    void useLibrary.getState().loadItems({ force: true });
    if (userId) {
      void logProductEvent(userId, 'content_saved');
      if (source === 'share_extension') void logProductEvent(userId, 'share_extension_used');
    }
    router.replace({ pathname: '/content/[id]', params: { id: res.item.id } });
  }, [busy, metadataForUrl, previewMetadata, router, source, trimmed, userId]);

  const retryPreview = async () => {
    if (!valid || platform !== 'Instagram' || !userId || metadataLoading) return;
    const candidateUrl = trimmed;
    setMetadataLoading(true);
    try {
      const metadata = await fetchLinkMetadata(candidateUrl, { force: true });
      if (trimmed !== candidateUrl) return;
      setPreviewMetadata(metadata);
      setMetadataForUrl(candidateUrl);
    } catch {
      if (trimmed === candidateUrl) {
        setPreviewMetadata(null);
        setMetadataForUrl(candidateUrl);
      }
    } finally {
      setMetadataLoading(false);
    }
  };

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
        <Pressable onPress={() => safeBack(router, '/(tabs)/home')} hitSlop={8} accessibilityLabel="Cancel save">
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
            {shownMetadata?.thumbnail_url && failedPreviewUrl !== shownMetadata.thumbnail_url ? (
              <Image
                source={{ uri: shownMetadata.thumbnail_url }}
                resizeMode="cover"
                onError={() => setFailedPreviewUrl(shownMetadata.thumbnail_url ?? null)}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.previewImageFallback}>
                <KIBPlatformLogo platform={platform} size={22} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                {shownMetadata?.title ?? `${platform} ${detectContentType(trimmed)}`}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                {shownMetadata?.creator_handle ?? shownMetadata?.creator_name ?? (metadataLoading ? 'Fetching creator details…' : 'Creator details unavailable')}
              </Text>
              {platform === 'Instagram' && metadataForUrl === trimmed && (!shownMetadata || failedPreviewUrl === shownMetadata.thumbnail_url) && !metadataLoading ? (
                <Pressable onPress={() => void retryPreview()} accessibilityRole="button" accessibilityLabel="Retry Instagram preview">
                  <Text style={{ color: colors.accent, fontSize: 12, marginTop: 3 }}>Retry preview</Text>
                </Pressable>
              ) : null}
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
                {trimmed}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={[type.caption as any, { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.md }]}>
          {platform === 'Instagram'
            ? 'Instagram URLs are sent to an external preview provider for public metadata.'
            : 'The platform and content type are detected from the URL itself.'}
        </Text>
        <KIBButton label={busy ? 'Saving…' : 'Save'} onPress={() => void doSave()} disabled={!valid || busy} />
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
  previewImage: { width: 70, height: 78, borderRadius: radius.sm, marginRight: 12, backgroundColor: colors.surface3 },
  previewImageFallback: { width: 70, height: 78, borderRadius: radius.sm, marginRight: 12, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
});
