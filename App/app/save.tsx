import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { KIBText as Text } from '../src/components/KIBText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../src/auth/AuthProvider';
import { KIBButton } from '../src/components/KIBPrimitives';
import { KIBPlatformLogo } from '../src/components/KIBPlatformLogo';
import { KIBConfetti, KIBKip, useReducedMotion } from '../src/components/KIBKip';
import { saveUrlWithOffline } from '../src/lib/sync';
import { fetchLinkMetadata } from '../src/api/linkMetadata';
import type { LinkMetadata } from '../src/api/linkMetadata';
import { logProductEvent } from '../src/api/analytics';
import { useLibrary } from '../src/store/useLibrary';
import { detectContentType, detectPlatform, isValidUrl } from '../src/lib/platform';
import { colors, fontFamily, radius, spacing, type } from '../src/theme';
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
  const reducedMotion = useReducedMotion();
  const [celebrating, setCelebrating] = useState(false);
  const [burst] = useState(() => new Animated.Value(0));

  // Brief "saved" moment (check, ribbons, happy Kip) before the item opens.
  const celebrateThen = useCallback((next: () => void) => {
    if (reducedMotion) { next(); return; }
    setCelebrating(true);
    burst.setValue(0);
    Animated.spring(burst, { toValue: 1, stiffness: 220, damping: 13, mass: 0.8, useNativeDriver: true }).start();
    setTimeout(next, 750);
  }, [burst, reducedMotion]);

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
    const res = await saveUrlWithOffline(valueToSave, { userId, source, metadata });
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
    if ('queued' in res && res.queued) {
      // Saved on-device while offline; the sync engine pushes it once a
      // connection returns. The item screen shows its pending state.
      void useLibrary.getState().loadItems({ force: true });
      celebrateThen(() => router.replace({ pathname: '/content/[id]', params: { id: res.item.id } }));
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
    celebrateThen(() => router.replace({ pathname: '/content/[id]', params: { id: res.item.id } }));
  }, [busy, celebrateThen, metadataForUrl, previewMetadata, router, source, trimmed, userId]);

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
          <Text style={{ color: colors.textSecondary, fontSize: 15, fontFamily: fontFamily.bodyMedium }}>Cancel</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 15, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>Save</Text>
      </View>

      <View style={{ marginTop: spacing.xl, paddingRight: 70 }}>
        <Text style={[type.display, { color: colors.text, fontSize: 34, lineHeight: 40 }]}>Save something</Text>
        <KIBKip size={40} mood={error ? 'worried' : 'calm'} style={{ position: 'absolute', right: 8, top: -6 }} />
      </View>

      <View style={[styles.inputWrap, error ? { borderColor: colors.error, backgroundColor: colors.surface } : null]}>
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
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'flex-start' }} accessibilityLiveRegion="polite">
          <FontAwesomeFreeSolid name="triangle-exclamation" size={13} color={colors.error} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md, gap: spacing.md }}>
        <KIBButton label="Paste from Clipboard" faIcon="clipboard" variant="secondary" onPress={pasteFromClipboard} />
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
              <Text style={{ color: colors.text, fontSize: 14, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }} numberOfLines={1}>
                {shownMetadata?.title ?? `${platform} ${detectContentType(trimmed)}`}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                {shownMetadata?.creator_handle ?? shownMetadata?.creator_name ?? (metadataLoading ? 'Fetching creator details…' : 'Creator details unavailable')}
              </Text>
              {platform === 'Instagram' && metadataForUrl === trimmed && (!shownMetadata || failedPreviewUrl === shownMetadata.thumbnail_url) && !metadataLoading ? (
                <Pressable onPress={() => void retryPreview()} accessibilityRole="button" accessibilityLabel="Retry Instagram preview">
                  <Text style={{ color: colors.text, fontSize: 12, marginTop: 3, fontFamily: fontFamily.bodyStrong, fontWeight: '700', textDecorationLine: 'underline' }}>Retry preview</Text>
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
        <View>
          {celebrating ? (
            <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite" accessibilityLabel="Saved">
              <Animated.View style={{ position: 'absolute', bottom: 64, transform: [{ translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }, { scale: burst }] }}>
                <KIBKip size={48} mood="happy" animated={false} />
              </Animated.View>
              <Animated.View style={[styles.savedDot, { transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
                <FontAwesomeFreeSolid name="check" size={22} color={colors.paper} />
              </Animated.View>
              <KIBConfetti play={celebrating} count={16} spread={170} />
            </View>
          ) : (
            <KIBButton label={busy ? 'Saving…' : 'Save'} onPress={() => void doSave()} disabled={!valid || busy} style={{ height: 54 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputWrap: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: 'rgba(28,23,24,0.14)',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    minHeight: 112,
    paddingHorizontal: 18,
    paddingVertical: spacing.lg,
  },
  input: { color: colors.text, fontSize: 15, lineHeight: 22, padding: 0, textAlignVertical: 'top', fontFamily: fontFamily.body },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  previewImage: { width: 70, height: 78, borderRadius: 14, marginRight: 14, backgroundColor: colors.surface3 },
  previewImageFallback: { width: 70, height: 78, borderRadius: 14, marginRight: 14, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  savedDot: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
