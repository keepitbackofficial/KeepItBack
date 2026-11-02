import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import * as Network from 'expo-network';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KIBBottomSheet } from '../../src/components/KIBContent';
import { KIBPlatformLogo } from '../../src/components/KIBPlatformLogo';
import { KIBButton, KIBTag } from '../../src/components/KIBPrimitives';
import { describeDbError, getSupabase } from '../../src/lib/supabase';
import { createCategory, deleteItem, fetchItem, markOpened, setItemTags, updateItem } from '../../src/api/items';
import { fetchLinkMetadata } from '../../src/api/linkMetadata';
import { fetchProfile } from '../../src/api/profile';
import { logProductEvent } from '../../src/api/analytics';
import { deletePendingSave, getCachedItems, getDownloads, getPendingLocalItems, queueItemDelete, queueItemUpdate, removeCachedItem, updateCachedItem, updatePendingSave } from '../../src/lib/localStore';
import { deleteDownloadedMedia, downloadSavedMedia } from '../../src/lib/downloads';
import { videoDownloadSupported } from '../../src/lib/mediaDownload';
import { useAuth } from '../../src/auth/AuthProvider';
import { useLibrary } from '../../src/store/useLibrary';
import { useDownloads } from '../../src/store/useDownloads';
import { SavedItem } from '../../src/types';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBKip } from '../../src/components/KIBKip';
import { CollectionCheck } from '../../src/components/KIBCollectionCheck';
import { colors, fontFamily, radius, spacing, type } from '../../src/theme';
import { safeBack } from '../../src/lib/navigation';

/**
 * SCREEN — CONTENT DETAILS. Shows only fields that actually exist in the
 * user's row. Opening the original uses Linking; the open counter is a
 * real database increment (best effort). Downloads are limited to direct
 * HTTPS media links and require an explicit permission confirmation.
 */
export default function ContentDetails() {
  const { id, duplicate } = useLocalSearchParams<{ id: string; duplicate?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const [item, setItem] = useState<SavedItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagText, setTagText] = useState('');
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadUri, setDownloadUri] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const openedOnce = useRef(false);

  const recordId = item ? (item.remote_id ?? item.id) : null;
  const downloadJob = useDownloads((state) => {
    if (!item || !recordId) return undefined;
    return Object.values(state.jobs).find((existing) =>
      (existing.item.remote_id ?? existing.item.id) === recordId || existing.item.canonical_url === item.canonical_url);
  });
  const downloadActive = Boolean(downloadJob && (downloadJob.stage === 'resolving' || downloadJob.stage === 'downloading'));

  useEffect(() => {
    void (async () => {
      if (!id) return;
      try {
        let mapped: SavedItem | null = null;
        if (id.startsWith('local:') && userId) {
          const [pending, cached] = await Promise.all([getPendingLocalItems(userId), getCachedItems(userId)]);
          mapped = [...pending, ...cached].find((saved) => saved.id === id) ?? null;
        } else {
          let cached: SavedItem | undefined;
          if (userId) cached = (await getCachedItems(userId)).find((saved) => saved.id === id && (saved.sync_state === 'pending' || saved.sync_state === 'error'));
          if (cached) mapped = cached;
          else {
            const result = await fetchItem(id);
            if ('data' in result) mapped = result.data;
            else if (userId) mapped = (await getCachedItems(userId)).find((saved) => saved.id === id) ?? null;
          }
        }
        if (!mapped) {
          setLoadError('This item is not available in the current library or offline cache.');
          return;
        }
        setItem(mapped);
        setNote(mapped.note ?? '');
        setTitle(mapped.title);
        setCategory(mapped.category ?? '');
        setTagText((mapped.tags ?? []).join(', '));
        if (userId) {
          try {
            const savedId = mapped.remote_id ?? mapped.id;
            const local = (await getDownloads(userId)).find((saved) => saved.item_id === savedId || saved.item_id === mapped?.id);
            const exists = Boolean(local && new File(local.local_uri).exists);
            if (local && !exists) await deleteDownloadedMedia(userId, local.item_id);
            setDownloaded(exists);
            setDownloadUri(exists ? local?.local_uri ?? null : null);
          } catch { setDownloaded(false); setDownloadUri(null); }
        }
        const openedId = mapped.remote_id ?? mapped.id;
        if (!openedId.startsWith('local:') && !openedOnce.current) {
          openedOnce.current = true;
          void markOpened(openedId);
          if (userId) void logProductEvent(userId, 'content_opened');
        }
      } catch (e: any) {
        setLoadError(describeDbError(e));
      }
    })();
  }, [id, userId]);

  // Only collections the item currently belongs to get a checkmark.
  useEffect(() => {
    void (async () => {
      if (!id || !collectionsOpen) return;
      try {
        const db = getSupabase();
        const itemId = item?.remote_id ?? id;
        const res = await db
          .from('collections')
          .select('id, name, emoji, collection_items!inner(item_id)')
          .eq('collection_items.item_id', itemId);
        if (!res.error) {
          const rows = (res.data as any[]) ?? [];
          setMemberIds(rows.filter((r) => r.collection_items?.length).map((r) => r.id));
        }
      } catch {
        // Collections sheet still shows with empty selection.
      }
    })();
  }, [id, item?.remote_id, collectionsOpen]);

  const saveEdits = async () => {
    if (!id || busy) return;
    if (!item || !userId) return;
    setBusy(true);
    try {
      const nextCategory = category.trim() || null;
      const network = await Network.getNetworkStateAsync().catch(() => null);
      if (nextCategory && !id.startsWith('local:') && network?.isConnected !== false) {
        const categoryResult = await createCategory(nextCategory);
        if ('error' in categoryResult) {
          Alert.alert('Category could not be saved', categoryResult.error);
          return;
        }
      }
      const patch = { title: title.trim() || item.title, note: note.trim() || null, category: nextCategory };
    if (id.startsWith('local:') && !item.remote_id) {
        const ok = await updatePendingSave(userId, id, patch);
        if (!ok) { Alert.alert('Save failed', 'This offline save is no longer in the sync queue.'); return; }
        const updated = { ...item, ...patch, sync_state: 'pending' as const };
        setItem(updated);
        await updateCachedItem(userId, updated);
      } else {
        const remoteId = item.remote_id ?? id;
        const result = await updateItem(remoteId, patch);
        if ('error' in result) {
          const network = await Network.getNetworkStateAsync().catch(() => null);
          if (!network || (network.isConnected !== false && network.isInternetReachable !== false)) { Alert.alert('Save failed', result.error); return; }
          await queueItemUpdate(userId, item, patch);
          setItem({ ...item, ...patch, sync_state: 'pending' });
        } else {
          const updated = id.startsWith('local:') ? { ...result.data, id, remote_id: remoteId } : result.data;
          setItem(updated);
          await updateCachedItem(userId, updated).catch(() => undefined);
          if (id.startsWith('local:')) await updateCachedItem(userId, result.data).catch(() => undefined);
        }
      }
      setEditOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const saveTags = async () => {
    if (!id || busy) return;
    if (!item || !userId) return;
    setBusy(true);
    try {
      const names = [...new Set(tagText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
      if (names.length) void logProductEvent(userId, 'tag_added');
      if (id.startsWith('local:') && !item.remote_id) {
        const ok = await updatePendingSave(userId, id, { tags: names });
        if (!ok) { Alert.alert('Save failed', 'This offline save is no longer in the sync queue.'); return; }
        const updated = { ...item, tags: names, sync_state: 'pending' as const };
        setItem(updated);
        await updateCachedItem(userId, updated);
      } else {
        const remoteId = item.remote_id ?? id;
        const result = await setItemTags(remoteId, names);
        if ('error' in result) {
          const network = await Network.getNetworkStateAsync().catch(() => null);
          if (!network || (network.isConnected !== false && network.isInternetReachable !== false)) { Alert.alert('Save failed', result.error); return; }
          await queueItemUpdate(userId, item, { tags: names });
        }
        const updated = { ...item, tags: names, sync_state: result && 'error' in result ? 'pending' as const : 'synced' as const };
        setItem(updated);
        await updateCachedItem(userId, updated).catch(() => undefined);
        if (id.startsWith('local:') && item.remote_id) await updateCachedItem(userId, { ...updated, id: item.remote_id, remote_id: undefined }).catch(() => undefined);
      }
      setTagsOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const retryInstagramPreview = async () => {
    if (!item || !userId || previewBusy) return;
    const remoteId = item.remote_id ?? item.id;
    if (remoteId.startsWith('local:')) return;
    setPreviewBusy(true);
    try {
      const metadata = await fetchLinkMetadata(item.original_url, { force: true });
      if (!metadata) {
        Alert.alert('Preview unavailable', 'The preview provider did not return public metadata for this link. Try again later.');
        return;
      }
      const patch: {
        title?: string;
        description?: string | null;
        thumbnail_url?: string | null;
        creator_name?: string | null;
        creator_handle?: string | null;
      } = {};
      if (metadata.title && item.title === `${item.platform} ${item.content_type}`) patch.title = metadata.title;
      if (metadata.description && !item.description) patch.description = metadata.description;
      if (metadata.thumbnail_url && (!item.thumbnail_url || failedThumbnailUrl === item.thumbnail_url)) {
        patch.thumbnail_url = metadata.thumbnail_url;
      }
      if (metadata.creator_name && !item.creator_name) patch.creator_name = metadata.creator_name;
      if (metadata.creator_handle && !item.creator_handle) patch.creator_handle = metadata.creator_handle;
      if (!Object.keys(patch).length) {
        Alert.alert('Preview up to date', 'There are no additional preview details to save.');
        return;
      }
      const result = await updateItem(remoteId, patch);
      if ('error' in result) {
        Alert.alert('Preview could not be saved', result.error);
        return;
      }
      const updated = item.id.startsWith('local:') ? { ...result.data, id: item.id, remote_id: remoteId } : result.data;
      setItem(updated);
      await updateCachedItem(userId, result.data).catch(() => undefined);
      if (item.id.startsWith('local:')) await updateCachedItem(userId, updated).catch(() => undefined);
      void useLibrary.getState().loadItems({ force: true });
    } catch {
      Alert.alert('Preview unavailable', 'Could not fetch a preview right now. Check your connection and try again.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const toggleCollection = async (collectionId: string) => {
    if (!id) return;
    const itemId = item?.remote_id ?? id;
    if (!memberIds.includes(collectionId)) {
      setMemberIds((m) => [...m, collectionId]);
      const res = await getSupabase().from('collection_items').insert({ collection_id: collectionId, item_id: itemId });
      if (res.error) {
        setMemberIds((m) => m.filter((x) => x !== collectionId));
        Alert.alert('Save failed', describeDbError(res.error));
      }
    } else {
      setMemberIds((m) => m.filter((x) => x !== collectionId));
      const res = await getSupabase().from('collection_items').delete().eq('collection_id', collectionId).eq('item_id', itemId);
      if (res.error) {
        setMemberIds((m) => [...m, collectionId]);
        Alert.alert('Save failed', describeDbError(res.error));
      }
    }
  };

  const confirmDelete = () => {
    if (!id) return;
    Alert.alert('Delete item', 'Remove this saved link from your library? Any device download for it will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const remoteId = item?.remote_id ?? id;
            if (userId && id.startsWith('local:') && !item?.remote_id) {
              await deletePendingSave(userId, id);
            } else {
              const result = await deleteItem(remoteId);
              if ('error' in result) {
                const network = await Network.getNetworkStateAsync().catch(() => null);
                if (!userId || !network || (network.isConnected !== false && network.isInternetReachable !== false) || !item) {
                  Alert.alert('Delete failed', result.error);
                  return;
                }
                await queueItemDelete(userId, item);
              }
            }
            if (userId) await deleteDownloadedMedia(userId, remoteId).catch(() => undefined);
            if (userId) await removeCachedItem(userId, id).catch(() => undefined);
            if (userId && item?.remote_id) await removeCachedItem(userId, item.remote_id).catch(() => undefined);
            useLibrary.getState().removeLocalItem(id);
            if (userId) void logProductEvent(userId, 'item_deleted');
            safeBack(router, '/(tabs)/library');
          } catch (e: any) {
            Alert.alert('Delete failed', describeDbError(e));
          }
        },
      },
    ]);
  };

  const notifyDownloadComplete = async () => {
    if (!item || !userId) return;
    void logProductEvent(userId, 'download_completed');
    const profile = await fetchProfile(userId);
    if (profile.data?.notification_preferences?.download_complete) {
      try {
        const Notifications = await import('expo-notifications');
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
        if (permission.granted) {
          await Notifications.scheduleNotificationAsync({
            content: { title: 'Download ready', body: `${item.title} is saved on this device.` },
            trigger: null,
          });
        }
      } catch {
        Alert.alert('Download complete', 'The video is saved on this device, but notifications are unavailable in this app build.');
      }
    }
  };

  const startVideoDownload = async () => {
    if (!item || !userId) return;
    setDownloadBusy(true);
    if (userId) void logProductEvent(userId, 'download_started');
    const result = await useDownloads.getState().start(item, userId);
    setDownloadBusy(false);
    if (result.ok) {
      const finished = Object.values(useDownloads.getState().jobs)
        .find((existing) => (existing.item.remote_id ?? existing.item.id) === recordId && existing.doneUri);
      if (finished?.doneUri) { setDownloaded(true); setDownloadUri(finished.doneUri); }
      void useLibrary.getState().loadItems({ force: true });
      void notifyDownloadComplete();
      return;
    }
    if (result.error && result.error !== 'cancelled') {
      Alert.alert('Download unavailable', result.error);
    }
  };

  const beginDownload = () => {
    if (!item || !userId || downloadBusy) return;
    if (downloaded) {
      if (!downloadUri) { Alert.alert('Could not open download', 'The saved file is unavailable on this device.'); return; }
      void new File(downloadUri).preview({ title: item.title }).catch(() => Alert.alert('Could not open download', 'The saved file is unavailable on this device.'));
      return;
    }
    const reason = videoDownloadSupported(item);
    if (reason) { Alert.alert('Download unavailable', reason); return; }

    if (item.platform !== 'Web') {
      // Real video download through the KeepItBack media service (V4 PRD §7.1).
      void startVideoDownload();
      return;
    }
    Alert.alert('Download direct media?', 'Confirm that you have permission to save this direct media file to your device. Only the direct file is downloaded; social platform links stay as references.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'I have permission', onPress: async () => {
        setDownloadBusy(true);
        if (userId) void logProductEvent(userId, 'download_started');
        const result = await downloadSavedMedia(item, userId);
        setDownloadBusy(false);
        if (result.error) { Alert.alert('Download unavailable', result.error); return; }
        setDownloaded(true);
        setDownloadUri(result.data?.local_uri ?? null);
        void notifyDownloadComplete();
      } },
    ]);
  };

  if (loadError) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.error, textAlign: 'center' }}>{loadError}</Text>
        <KIBButton label="Back" variant="secondary" onPress={() => safeBack(router, '/(tabs)/library')} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Loading saved item…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 48 }}>
      {duplicate === '1' ? (
        <View style={styles.duplicateBanner}>
          <FontAwesomeFreeSolid name="triangle-exclamation" size={14} color={colors.warning} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.warning, fontSize: 13, flex: 1, fontFamily: fontFamily.bodyMedium, fontWeight: '600' }}>You already had this saved — this is the original entry.</Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.platformPill} accessibilityLabel={`${item.platform} logo`}>
            <KIBPlatformLogo platform={item.platform} size={14} />
            <Text style={{ color: colors.text, fontSize: 12, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{item.platform}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.bodyMedium }}>{item.content_type}</Text>
        </View>
        <Text style={[type.h2, { color: colors.text, marginTop: spacing.md }]}>{item.title}</Text>
        {item.thumbnail_url ? (
          <View style={{ width: '100%', height: 220, borderRadius: radius.lg + 4, marginTop: spacing.lg, backgroundColor: colors.surface3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {failedThumbnailUrl === item.thumbnail_url ? (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <FontAwesomeFreeSolid name="rotate-right" size={24} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cover unavailable · retry preview below</Text>
              </View>
            ) : (
              <Image
                source={{ uri: item.thumbnail_url }}
                resizeMode="cover"
                onError={() => setFailedThumbnailUrl(item.thumbnail_url ?? null)}
                style={{ width: '100%', height: '100%' }}
              />
            )}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: spacing.md }}>
          {item.category ? <View style={styles.categoryPill}><Text style={{ color: colors.text, fontSize: 12, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{item.category}</Text></View> : null}
          {item.creator_handle || item.creator_name ? (
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.bodyMedium, fontWeight: '600' }}>{item.creator_handle ?? item.creator_name}</Text>
          ) : null}
        </View>
        {item.sync_state === 'pending' || item.sync_state === 'error' ? <Text style={{ color: item.sync_state === 'error' ? colors.error : colors.warning, marginTop: 6, fontSize: 12, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{item.sync_state === 'error' ? 'Sync needs a retry' : 'Waiting to sync from this device'}</Text> : null}

        <View style={styles.metaCard}>
          {[
            ['Saved', new Date(item.saved_at).toLocaleString()],
            ['Opened', `${item.open_count} time${item.open_count === 1 ? '' : 's'}`],
            ['Source', item.source],
          ].map(([label, value], i) => (
            <View key={label} style={[{ flexDirection: 'row', paddingVertical: 11 }, i < 2 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.textMuted, fontSize: 13, width: 80 }}>{label}</Text>
              <Text style={{ color: colors.text, fontSize: 13, flex: 1, fontFamily: fontFamily.bodyMedium, fontWeight: '600' }}>{value}</Text>
            </View>
          ))}
        </View>

        {item.note ? (
          <View style={styles.noteBox}>
            <KIBKip size={34} style={{ position: 'absolute', right: 14, top: -30 }} />
            <Text style={[type.overline, { color: colors.textMuted, marginBottom: 4 }]}>Note</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 21 }}>{item.note}</Text>
          </View>
        ) : null}

        {(item.tags ?? []).length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
            {(item.tags ?? []).map((t) => (
              <KIBTag key={t} label={t} />
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <KIBButton
            label="Open original"
            faIcon="arrow-up-right-from-square"
            onPress={async () => {
              const ok = await Linking.canOpenURL(item.original_url);
              if (!ok) {
                Alert.alert('Could not open', 'This link can\u2019t be opened on this device.');
                return;
              }
              await Linking.openURL(item.original_url);
            }}
          />
          {item.platform === 'Instagram' && (!item.thumbnail_url || failedThumbnailUrl === item.thumbnail_url || (!item.creator_handle && !item.creator_name) || item.title === `${item.platform} ${item.content_type}`) && (!item.id.startsWith('local:') || Boolean(item.remote_id)) ? (
            <KIBButton label={previewBusy ? 'Fetching preview…' : 'Retry Instagram preview'} faIcon="rotate-right" variant="secondary" disabled={previewBusy} onPress={() => void retryInstagramPreview()} />
          ) : null}
          <View style={styles.actionRow}>
            <TrioButton icon="pen" label="Edit" onPress={() => setEditOpen(true)} />
            <TrioButton icon="tag" label="Tags" onPress={() => setTagsOpen(true)} />
            <TrioButton icon="folder" label="Collections" disabled={item.id.startsWith('local:') && !item.remote_id} onPress={() => setCollectionsOpen(true)} />
          </View>
          {downloadJob && (downloadJob.stage === 'resolving' || downloadJob.stage === 'downloading') ? (
            <View style={styles.progressCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontSize: 13, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>
                  {downloadJob.stage === 'resolving' ? 'Resolving video…' : 'Downloading video…'}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Cancel download" hitSlop={10}
                  onPress={() => downloadJob && void useDownloads.getState().cancel(downloadJob.key)}>
                  <Text style={{ color: colors.error, fontSize: 13, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${dlPercent(downloadJob)}%` }]} />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {fmtBytes(downloadJob.progress.receivedBytes)}{downloadJob.progress.totalBytes ? ` / ${fmtBytes(downloadJob.progress.totalBytes)}` : ''}
              </Text>
            </View>
          ) : downloadJob && downloadJob.stage === 'error' ? (
            <View style={[styles.progressCard, { gap: spacing.sm }]}>
              <Text style={{ color: colors.error, fontSize: 13 }}>{downloadJob.error}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Retry download" hitSlop={10}
                onPress={() => { useDownloads.getState().clearJob(downloadJob.key); void startVideoDownload(); }}>
                <Text style={{ color: colors.text, fontSize: 13, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>Retry</Text>
              </Pressable>
            </View>
          ) : downloadJob && downloadJob.stage === 'done' ? (
            <View style={{ gap: spacing.xs }}>
              <KIBButton label="Open device download" faIcon="folder-open" variant="secondary" onPress={beginDownload} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {downloadJob.gallerySaved === false
                  ? 'Also copied to your gallery unless the gallery permission was denied.'
                  : 'Also visible in your gallery under the KeepItBack album.'}
              </Text>
            </View>
          ) : (
            <KIBButton
              label={downloadBusy || downloadActive ? (downloadJob?.stage === 'resolving' ? 'Resolving…' : 'Downloading…') : downloaded ? 'Open device download' : 'Download video'}
              faIcon="download"
              variant="secondary"
              disabled={downloadBusy || downloadActive || (!downloaded && Boolean(videoDownloadSupported(item)))}
              onPress={beginDownload}
            />
          )}
          <KIBButton label="Delete saved item" faIcon="trash-can" variant="danger" onPress={confirmDelete} />
          <KIBButton label="Back to library" variant="ghost" onPress={() => router.replace('/(tabs)/library')} />
        </View>

        {item.duration_s || (item.width && item.height) ? (
          <View style={[styles.metaCard, { marginTop: spacing.xl }]}>
            {[
              ...(item.duration_s ? [['Duration', fmtDuration(item.duration_s)] as [string, string]] : []),
              ...(item.width && item.height ? [['Resolution', `${item.width} × ${item.height}`] as [string, string]] : []),
              ...(item.media_size_bytes ? [['Download size', fmtBytes(item.media_size_bytes)] as [string, string]] : []),
              ...(item.media_mime_type ? [['Format', item.media_mime_type] as [string, string]] : []),
            ].map(([mediaLabel, mediaValue], i, rows) => (
              <View key={mediaLabel} style={[{ flexDirection: 'row', paddingVertical: 11 }, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: 13, width: 110 }}>{mediaLabel}</Text>
                <Text style={{ color: colors.text, fontSize: 13, flex: 1, fontFamily: fontFamily.bodyMedium, fontWeight: '600' }}>{mediaValue}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.downloadNote}>
        <FontAwesomeFreeSolid name="shield-halved" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 }}>
          Videos from Instagram, YouTube, Pinterest and X are extracted by the KeepItBack media service and saved as MP4 files on this device. Direct web media is checked before download; you confirm you have permission to keep a device copy.
        </Text>
      </View>

      <KIBBottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit details">
        <View style={{ gap: spacing.md }}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} accessibilityLabel="Title" style={styles.textInput} />
          <Text style={styles.fieldLabel}>Category</Text>
          <TextInput value={category} onChangeText={setCategory} accessibilityLabel="Category" placeholder="Add a category" placeholderTextColor={colors.textMuted} style={styles.textInput} />
          <Text style={styles.fieldLabel}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            accessibilityLabel="Note"
            placeholder="What did you save it for?"
            placeholderTextColor={colors.textMuted}
            style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
          />
          <KIBButton label={busy ? 'Saving…' : 'Save changes'} onPress={saveEdits} disabled={busy} />
        </View>
      </KIBBottomSheet>

      <KIBBottomSheet visible={tagsOpen} onClose={() => setTagsOpen(false)} title="Tags">
        <View style={{ gap: spacing.md }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Comma-separated. Real database rows per user.</Text>
          <TextInput
            value={tagText}
            onChangeText={setTagText}
            placeholder="recipes, weekend-plans…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            accessibilityLabel="Tags"
            style={styles.textInput}
          />
          <KIBButton label={busy ? 'Saving…' : 'Save tags'} onPress={saveTags} disabled={busy} />
        </View>
      </KIBBottomSheet>

      <KIBBottomSheet visible={collectionsOpen} onClose={() => setCollectionsOpen(false)} title="Collections">
        <CollectionPicker itemCollections={memberIds} onToggle={toggleCollection} />
      </KIBBottomSheet>
    </ScrollView>
  );
}

function CollectionPicker({
  itemCollections,
  onToggle,
}: {
  itemCollections: string[];
  onToggle: (id: string) => void | Promise<void>;
}) {
  const [collections, setCollections] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const db = getSupabase();
        const res = await db.from('collections').select('id, name, emoji').order('created_at', { ascending: false });
        if (res.error) setError(describeDbError(res.error));
        else setCollections((res.data as any[]) ?? []);
      } catch (e: any) {
        setError(describeDbError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Text style={{ color: colors.textMuted }}>Loading collections…</Text>;
  if (error) return <Text style={{ color: colors.error }}>{error}</Text>;
  if (!collections.length)
    return <Text style={{ color: colors.textMuted }}>No collections yet — create one from the Library tab.</Text>;

  return (
    <View style={{ gap: spacing.sm }}>
      {collections.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onToggle(c.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: itemCollections.includes(c.id) }}
          style={styles.collectionRow2}
        >
          <View style={styles.collectionEmoji}><Text style={{ fontSize: 21 }}>{c.emoji}</Text></View>
          <Text style={{ color: colors.text, fontSize: 15, flex: 1, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{c.name}</Text>
          <CollectionCheck checked={itemCollections.includes(c.id)} />
        </Pressable>
      ))}
    </View>
  );
}

function TrioButton({ icon, label, onPress, disabled }: { icon: 'pen' | 'tag' | 'folder'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [styles.trio, { opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <FontAwesomeFreeSolid name={icon} size={16} color={colors.text} />
      <Text style={{ color: colors.text, fontSize: 12, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  duplicateBanner: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  platformPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingLeft: 9, paddingRight: 12, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  categoryPill: { height: 28, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.sky, justifyContent: 'center' },
  metaCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 2 },
  noteBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xxl + 12,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  trio: { flex: 1, height: 66, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  progressCard: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent, minWidth: 8 },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontFamily: fontFamily.bodyStrong, fontWeight: '700' },
  textInput: {
    height: 50,
    backgroundColor: colors.bg,
    borderColor: 'transparent',
    borderWidth: 1.5,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    fontFamily: fontFamily.body,
  },
  downloadNote: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(28,23,24,0.05)',
    borderRadius: radius.md,
  },
  collectionRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  collectionEmoji: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});

function fmtBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutesPart = Math.floor(total / 60);
  const secondsPart = String(total % 60).padStart(2, '0');
  return minutesPart > 0 ? `${minutesPart}:${secondsPart}` : `0:${secondsPart}`;
}

function dlPercent(job: { progress: { receivedBytes: number; totalBytes: number | null } }): number {
  if (!job.progress.totalBytes || job.progress.totalBytes <= 0) return 0;
  return Math.min(100, Math.max(3, Math.round((job.progress.receivedBytes / job.progress.totalBytes) * 100)));
}
