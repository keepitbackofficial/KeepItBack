import { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createCollectionInvite, fetchCollectionWithItems, updateCollection, deleteCollection, removeCollectionItem } from '../../src/api/collections';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBErrorState } from '../../src/components/KIBPrimitives';
import { Collection, SavedItem } from '../../src/types';
import { colors, spacing, type } from '../../src/theme';

export default function CollectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [inviteCode, setInviteCode] = useState('');
  const [sharing, setSharing] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const res = await fetchCollectionWithItems(id);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'Collection not found.');
      return;
    }
    setName(res.data.collection.name);
    setCollection(res.data.collection);
    setItems(res.data.items);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!id) return;
      const res = await fetchCollectionWithItems(id);
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error ?? 'Collection not found.');
        setLoading(false);
        return;
      }
      setName(res.data.collection.name);
      setCollection(res.data.collection);
      setItems(res.data.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Loading collection…</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <KIBErrorState onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {renaming ? (
          <TextInput value={name} onChangeText={setName} accessibilityLabel="Collection name" style={styles.renameInput} />
        ) : (
          <Text style={[type.h3 as any, { color: colors.text, flex: 1 }]}>{name}</Text>
        )}
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
      </View>
      {collection?.is_shared ? (
        <Text style={{ color: colors.accent, fontSize: 12, paddingHorizontal: spacing.xl, marginTop: spacing.xs }}>
          Shared collection · your role: {collection.role ?? 'member'} · personal notes and tags stay private
        </Text>
      ) : null}

      {items.length === 0 ? (
        <KIBEmptyState emoji="📭" title="Empty collection" message="Add saved links to this collection from any item's Collections action." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, marginTop: spacing.md, paddingBottom: 40, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <KIBContentRow item={item} onPress={() => collection?.is_shared ? void Linking.openURL(item.original_url) : router.push(`/content/${item.id}`)} />
              </View>
              {collection?.role === 'owner' || collection?.role === 'editor' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Remove link from collection" onPress={() => {
                  Alert.alert('Remove this link?', 'It will stay in its owner’s library.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: async () => {
                      const result = await removeCollectionItem(collection.id, item.id);
                      if (result.error) Alert.alert('Could not remove link', result.error);
                      else setItems((current) => current.filter((saved) => saved.id !== item.id));
                    } },
                  ]);
                }} style={{ padding: 10 }}><Text style={{ color: colors.error, fontSize: 18 }}>×</Text></Pressable>
              ) : null}
            </View>
          )}
        />
      )}

      <View style={{ paddingHorizontal: spacing.xl, gap: 8, paddingBottom: insets.bottom + 24 }}>
        {collection?.role === 'owner' || collection?.role === 'editor' ? (
          <>
            {collection?.is_shared ? <KIBButton label="Add my saved links" variant="secondary" onPress={() => router.push({ pathname: '/collections/add', params: { collectionId: collection.id } })} /> : null}
            <KIBButton label={sharing ? 'Creating invite…' : 'Invite a member'} variant="secondary" disabled={sharing} onPress={() => {
              setInviteCode('');
              setSharing(true);
            }} />
          </>
        ) : null}
        {collection?.role === 'owner' ? <KIBButton
          label={renaming ? (busy ? 'Renaming…' : 'Save name') : 'Rename collection'}
          variant="secondary"
          disabled={busy}
          onPress={async () => {
            if (!id) return;
            if (renaming) {
              if (!name.trim()) return;
              setBusy(true);
              const res = await updateCollection(id, { name: name.trim() });
              setBusy(false);
              if (res.error) {
                Alert.alert('Rename failed', res.error);
                return;
              }
            }
            setRenaming((r) => !r);
          }}
        /> : null}
        {collection?.role === 'owner' ? <KIBButton
          label="Delete collection"
          variant="danger"
          onPress={() => {
            Alert.alert('Delete collection', 'Items stay in your library; only this grouping is removed.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  if (!id) return;
                  const res = await deleteCollection(id);
                  if (res.error) {
                    Alert.alert('Delete failed', res.error);
                    return;
                  }
                  router.back();
                },
              },
            ]);
          }}
        /> : null}
        <KIBButton label="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      {sharing ? (
        <View style={styles.sharePanel}>
          <Text style={[type.h3 as any, { color: colors.text }]}>Invite to this collection</Text>
          <Text style={{ color: colors.textSecondary, marginTop: spacing.xs }}>Choose what the invitee can do.</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md }}>
            {(collection?.role === 'owner' ? ['viewer', 'editor'] as const : ['viewer'] as const).map((role) => (
              <Pressable key={role} onPress={() => setInviteRole(role)} style={[styles.roleChip, inviteRole === role && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                <Text style={{ color: inviteRole === role ? colors.white : colors.text }}>{role === 'viewer' ? 'Viewer · view links' : 'Editor · add or remove links'}</Text>
              </Pressable>
            ))}
          </View>
          {inviteCode ? (
            <>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>One-time code · expires in 7 days</Text>
              <Text selectable style={[type.h2 as any, { color: colors.accent, letterSpacing: 4, marginVertical: spacing.md }]}>{inviteCode}</Text>
              <KIBButton label="Share invite code" onPress={() => void Share.share({ message: `Join my KeepItBack collection “${name}”. Open KeepItBack → Collections → Join with code: ${inviteCode}` })} />
            </>
          ) : (
            <KIBButton label="Create invite code" disabled={busy} onPress={async () => {
              if (!collection) return;
              setBusy(true);
              const res = await createCollectionInvite(collection.id, inviteRole);
              setBusy(false);
              if (res.error || !res.data) Alert.alert('Invite unavailable', res.error ?? 'Could not create an invite.');
              else {
                setInviteCode(res.data.code);
                setCollection({ ...collection, is_shared: true });
              }
            }} />
          )}
          <KIBButton label="Close" variant="ghost" onPress={() => setSharing(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  renameInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
  },
  sharePanel: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 30, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, elevation: 8 },
  roleChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.sm, backgroundColor: colors.surface2 },
});
