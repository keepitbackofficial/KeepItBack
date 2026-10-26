import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KIBContentRow, KIBPlatformBadge, KIBBottomSheet } from '../../src/components/KIBContent';
import { KIBButton, KIBTag } from '../../src/components/KIBPrimitives';
import { describeDbError, getSupabase, isSupabaseConfigured } from '../../src/lib/supabase';
import { markOpened } from '../../src/api/items';
import { fetchConnectedAccounts } from '../../src/api/accounts';
import { SavedItem } from '../../src/types';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SCREEN — CONTENT DETAILS. Shows only fields that actually exist in the
 * user's row. Opening the original uses Linking; the open counter is a
 * real database increment (best effort). Downloads: KeepItBack saves
 * references; there is no permitted direct-download source for these
 * platform links, so the UI never pretends otherwise.
 */
export default function ContentDetails() {
  const { id, duplicate } = useLocalSearchParams<{ id: string; duplicate?: string }>();
  const router = useRouter();
  const [item, setItem] = useState<SavedItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagText, setTagText] = useState('');
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const openedOnce = useRef(false);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      try {
        const db = getSupabase();
        const { data, error } = await db.from('saved_items').select('*, item_tags(tag_id(tags(name)))').eq('id', id).maybeSingle();
        if (error) {
          setLoadError(describeDbError(error));
          return;
        }
        if (!data) {
          setLoadError('This item no longer exists in your library.');
          return;
        }
        const mapped: SavedItem = {
          ...(data as any),
          tags: ((data as any).item_tags ?? []).map((l: any) => l?.tag_id?.name).filter(Boolean),
        };
        setItem(mapped);
        setNote(mapped.note ?? '');
        setTitle(mapped.title);
        setTagText((mapped.tags ?? []).join(', '));
        if (!openedOnce.current) {
          openedOnce.current = true;
          void markOpened(id);
        }
      } catch (e: any) {
        setLoadError(describeDbError(e));
      }
    })();
  }, [id]);

  // Only collections the item currently belongs to get a checkmark.
  useEffect(() => {
    void (async () => {
      if (!id || !collectionsOpen) return;
      try {
        const db = getSupabase();
        const res = await db
          .from('collections')
          .select('id, name, emoji, collection_items!inner(item_id)')
          .eq('collection_items.item_id', id);
        if (!res.error) {
          const rows = (res.data as any[]) ?? [];
          setMemberIds(rows.filter((r) => r.collection_items?.length).map((r) => r.id));
        }
      } catch {
        // Collections sheet still shows with empty selection.
      }
    })();
  }, [id, collectionsOpen]);

  const reload = async (): Promise<SavedItem | null> => {
    if (!id) return null;
    try {
      const db = getSupabase();
      const { data } = await db.from('saved_items').select('*, item_tags(tag_id(tags(name)))').eq('id', id).maybeSingle();
      if (data) {
        const mapped: SavedItem = {
          ...(data as any),
          tags: ((data as any).item_tags ?? []).map((l: any) => l?.tag_id?.name).filter(Boolean),
        };
        setItem(mapped);
        return mapped;
      }
    } catch {
      // ignore — UI keeps last good state
    }
    return item;
  };

  const saveEdits = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const db = getSupabase();
      const { error } = await db
        .from('saved_items')
        .update({ title: title.trim() || undefined, note: note.trim() || null })
        .eq('id', id);
      if (error) {
        Alert.alert('Save failed', describeDbError(error));
        return;
      }
      await reload();
      setEditOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const saveTags = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const supabase = getSupabase();
      const names = [...new Set(tagText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
      if (!names.length) {
        // remove all tags from the item
        const cur = await supabase.from('item_tags').select('tag_id').eq('item_id', id);
        const ids = (cur.data ?? []).map((r: any) => r.tag_id);
        if (ids.length) {
          const del = await supabase.from('item_tags').delete().eq('item_id', id).in('tag_id', ids);
          if (del.error) {
            Alert.alert('Save failed', describeDbError(del.error));
            return;
          }
        }
      } else {
        const { data: upserted, error: upErr } = await supabase.from('tags').upsert(names.map((name) => ({ name })), { onConflict: 'name' }).select('id, name');
        if (upErr) {
          Alert.alert('Save failed', describeDbError(upErr));
          return;
        }
        const byName = new Map(((upserted ?? []) as any[]).map((t) => [t.name, t.id]));
        const missing = names.filter((n) => !byName.has(n));
        if (missing.length) {
          const { data: found, error: fErr } = await supabase.from('tags').select('id, name').in('name', missing);
          if (fErr) {
            Alert.alert('Save failed', describeDbError(fErr));
            return;
          }
          (found ?? []).forEach((t: any) => byName.set(t.name, t.id));
        }
        const newIds = names.map((n) => byName.get(n)).filter(Boolean);
        const cur = await supabase.from('item_tags').select('tag_id').eq('item_id', id);
        const existing = (cur.data ?? []).map((r: any) => r.tag_id);
        const toRemove = existing.filter((t: string) => !newIds.includes(t));
        const toAdd = (newIds as string[]).filter((t: string) => !existing.includes(t));
        if (toRemove.length) {
          const del = await supabase.from('item_tags').delete().eq('item_id', id).in('tag_id', toRemove);
          if (del.error) {
            Alert.alert('Save failed', describeDbError(del.error));
            return;
          }
        }
        if (toAdd.length) {
          const ins = await supabase.from('item_tags').insert(toAdd.map((tag_id) => ({ item_id: id, tag_id })));
          if (ins.error) {
            Alert.alert('Save failed', describeDbError(ins.error));
            return;
          }
        }
      }
      await supabase.from('item_tags').select().eq('item_id', id); // light consistency ping
      await reload();
      setTagsOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const toggleCollection = async (collectionId: string) => {
    if (!id) return;
    if (!memberIds.includes(collectionId)) {
      setMemberIds((m) => [...m, collectionId]);
      const res = await getSupabase().from('collection_items').insert({ collection_id: collectionId, item_id: id });
      if (res.error) {
        setMemberIds((m) => m.filter((x) => x !== collectionId));
        Alert.alert('Save failed', describeDbError(res.error));
      }
    } else {
      setMemberIds((m) => m.filter((x) => x !== collectionId));
      const res = await getSupabase().from('collection_items').delete().eq('collection_id', collectionId).eq('item_id', id);
      if (res.error) {
        setMemberIds((m) => [...m, collectionId]);
        Alert.alert('Save failed', describeDbError(res.error));
      }
    }
  };

  const confirmDelete = () => {
    if (!id) return;
    Alert.alert('Delete item', 'Remove this saved link permanently? Collections membership disappears too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await getSupabase().from('saved_items').delete().eq('id', id);
            if (res.error) {
              Alert.alert('Delete failed', describeDbError(res.error));
              return;
            }
            router.back();
          } catch (e: any) {
            Alert.alert('Delete failed', describeDbError(e));
          }
        },
      },
    ]);
  };

  if (loadError) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.error, textAlign: 'center' }}>{loadError}</Text>
        <KIBButton label="Back" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
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
          <KIBPlatformBadge platform={item.platform} withLabel />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.content_type}</Text>
        </View>
        <Text style={[type.h2 as any, { color: colors.text, marginTop: spacing.md }]}>{item.title}</Text>
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
          <View style={styles.actionRow}>
            <KIBButton label="Edit" variant="secondary" style={{ flex: 1 }} onPress={() => setEditOpen(true)} />
            <KIBButton label="Tags" variant="secondary" style={{ flex: 1 }} onPress={() => setTagsOpen(true)} />
            <KIBButton label="Collections" variant="secondary" style={{ flex: 1 }} onPress={() => setCollectionsOpen(true)} />
          </View>
          <KIBButton label="Delete saved item" variant="danger" onPress={confirmDelete} />
          <KIBButton label="Back to library" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>

      <View style={styles.downloadNote}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          KeepItBack stores a reference to this link. Downloading media to this device is only available for links with a permitted direct file source — for most platform links that means download unavailable, and no partial or full media fetch is attempted.
        </Text>
      </View>

      <KIBBottomSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit details">
        <View style={{ gap: spacing.md }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} accessibilityLabel="Title" style={styles.textInput} />
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
