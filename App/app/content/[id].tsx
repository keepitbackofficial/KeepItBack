import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import * as Network from 'expo-network';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KIBPlatformBadge, KIBBottomSheet } from '../../src/components/KIBContent';
import { KIBButton, KIBTag } from '../../src/components/KIBPrimitives';
import { describeDbError, getSupabase } from '../../src/lib/supabase';
import { createCategory, deleteItem, fetchItem, markOpened, setItemTags, updateItem } from '../../src/api/items';
import { fetchLinkMetadata } from '../../src/api/linkMetadata';
import { fetchProfile } from '../../src/api/profile';
import { logProductEvent } from '../../src/api/analytics';
import { deletePendingSave, getCachedItems, getDownloads, getPendingLocalItems, queueItemDelete, queueItemUpdate, removeCachedItem, updateCachedItem, updatePendingSave } from '../../src/lib/localStore';
import { deleteDownloadedMedia, directMediaReason, downloadSavedMedia } from '../../src/lib/downloads';
import { useAuth } from '../../src/auth/AuthProvider';
import { useLibrary } from '../../src/store/useLibrary';
import { SavedItem } from '../../src/types';
import { colors, radius, spacing, type } from '../../src/theme';
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

  const beginDownload = () => {
    if (!item || !userId || downloadBusy) return;
    if (downloaded) {
      if (!downloadUri) { Alert.alert('Could not open download', 'The saved file is unavailable on this device.'); return; }
      void new File(downloadUri).preview({ title: item.title }).catch(() => Alert.alert('Could not open download', 'The saved file is unavailable on this device.'));
      return;
    }
    const reason = directMediaReason(item);
    if (reason) { Alert.alert('Download unavailable', reason); return; }
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
        if (userId) {
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
              Alert.alert('Download complete', 'The media is saved on this device, but notifications are unavailable in this app build.');
            }
          }
        }
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {duplicate === '1' ? (
        <View style={styles.duplicateBanner}>
          <Text style={{ color: colors.warning, fontSize: 13 }}>You already had this saved — this is the original entry.</Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <KIBPlatformBadge platform={item.platform} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.content_type}</Text>
        </View>
        <Text style={[type.h2 as any, { color: colors.text, marginTop: spacing.md }]}>{item.title}</Text>
        {item.thumbnail_url ? (
          <View style={{ width: '100%', height: 190, borderRadius: radius.md, marginTop: spacing.md, backgroundColor: colors.surface3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {failedThumbnailUrl === item.thumbnail_url ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cover unavailable · retry preview below</Text>
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
        {item.category ? <Text style={{ color: colors.accent, marginTop: 4 }}>{item.category}</Text> : null}
        {item.sync_state === 'pending' || item.sync_state === 'error' ? <Text style={{ color: colors.warning, marginTop: 4, fontSize: 12 }}>{item.sync_state === 'error' ? 'Sync needs a retry' : 'Waiting to sync from this device'}</Text> : null}
        {item.creator_handle || item.creator_name ? (
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>{item.creator_handle ?? item.creator_name}</Text>
        ) : null}

        <View style={{ marginTop: spacing.md, gap: 6 }}>
          {[
            ['Saved', new Date(item.saved_at).toLocaleString()],
            ['Opened', `${item.open_count} time${item.open_count === 1 ? '' : 's'}`],
            ['Source', item.source],
          ].map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row' }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, width: 90 }}>{label}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1 }}>{value}</Text>
            </View>
          ))}
        </View>

        {item.note ? (
          <View style={styles.noteBox}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{item.note}</Text>
          </View>
        ) : null}

        {(item.tags ?? []).length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md }}>
            {(item.tags ?? []).map((t) => (
              <KIBTag key={t} label={t} />
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <KIBButton
            label="Open original ↗"
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
            <KIBButton label={previewBusy ? 'Fetching preview…' : 'Retry Instagram preview'} variant="secondary" disabled={previewBusy} onPress={() => void retryInstagramPreview()} />
          ) : null}
          <View style={styles.actionRow}>
            <KIBButton label="Edit" variant="secondary" style={{ flex: 1 }} onPress={() => setEditOpen(true)} />
            <KIBButton label="Tags" variant="secondary" style={{ flex: 1 }} onPress={() => setTagsOpen(true)} />
            <KIBButton label="Collections" variant="secondary" style={{ flex: 1 }} disabled={item.id.startsWith('local:') && !item.remote_id} onPress={() => setCollectionsOpen(true)} />
          </View>
          <KIBButton label={downloadBusy ? 'Downloading…' : downloaded ? 'Open device download' : directMediaReason(item) ? 'Download unavailable' : 'Download direct media'} variant="secondary" disabled={downloadBusy || (!downloaded && Boolean(directMediaReason(item)))} onPress={beginDownload} />
          <KIBButton label="Delete saved item" variant="danger" onPress={confirmDelete} />
          <KIBButton label="Back to library" variant="ghost" onPress={() => router.replace('/(tabs)/library')} />
        </View>
      </View>

      <View style={styles.downloadNote}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          Social links remain saved references and cannot be downloaded here. Direct media links are checked before download, and require you to confirm you have permission to keep a device copy.
        </Text>
      </View>

      <KIBBottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit details">
        <View style={{ gap: spacing.md }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} accessibilityLabel="Title" style={styles.textInput} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Category</Text>
          <TextInput value={category} onChangeText={setCategory} accessibilityLabel="Category" placeholder="Add a category" placeholderTextColor={colors.textMuted} style={styles.textInput} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Note</Text>
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
          <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>
            {c.emoji} {c.name}
          </Text>
          <Text style={{ color: itemCollections.includes(c.id) ? colors.success : colors.textMuted, fontSize: 16 }}>
            {itemCollections.includes(c.id) ? '✓' : '+'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  duplicateBanner: {
    backgroundColor: 'rgba(245,185,66,0.12)',
    borderColor: 'rgba(245,185,66,0.4)',
    borderWidth: 1,
    padding: spacing.md,
  },
  noteBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  textInput: {
    height: 48,
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  downloadNote: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  collectionRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
