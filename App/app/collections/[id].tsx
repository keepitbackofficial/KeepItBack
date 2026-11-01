import { useEffect, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createCollectionInvite, fetchCollectionWithItems, updateCollection, deleteCollection, removeCollectionItem } from '../../src/api/collections';
import { KIBContentRow } from '../../src/components/KIBContent';
import { KIBButton, KIBEmptyState, KIBErrorState } from '../../src/components/KIBPrimitives';
import { Collection, SavedItem } from '../../src/types';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, radius, spacing, type } from '../../src/theme';
import { safeBack } from '../../src/lib/navigation';

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
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {collection?.emoji ? <View style={styles.emojiTile}><Text style={{ fontSize: 26 }}>{collection.emoji}</Text></View> : null}
            <Text style={[type.h2, { color: colors.text, flex: 1 }]} numberOfLines={2}>{name}</Text>
          </View>
        )}
        <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.bodyMedium, marginLeft: spacing.sm }}>{items.length} item{items.length === 1 ? '' : 's'}</Text>
      </View>
      {collection?.is_shared ? (
        <View style={styles.sharedBanner}>
          <FontAwesomeFreeSolid name="users" size={13} color={colors.text} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.text, fontSize: 12, lineHeight: 17, flex: 1, fontFamily: fontFamily.bodyMedium, fontWeight: '600' }}>
            Shared collection · your role: {collection.role ?? 'member'} · personal notes and tags stay private
          </Text>
        </View>
      ) : null}

      {items.length === 0 ? (
        <KIBEmptyState icon="inbox" title="Empty collection" message="Add saved links to this collection from any item's Collections action." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
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
                }} style={styles.removeDot}><FontAwesomeFreeSolid name="xmark" size={13} color={colors.error} /></Pressable>
              ) : null}
            </View>
          )}
        />
      )}

      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: insets.bottom + 20 }}>
        {collection?.role === 'owner' || collection?.role === 'editor' ? (
          <>
            {collection?.is_shared ? <KIBButton label="Add my saved links" faIcon="plus" variant="secondary" style={styles.half} onPress={() => router.push({ pathname: '/collections/add', params: { collectionId: collection.id } })} /> : null}
            <KIBButton label={sharing ? 'Creating invite…' : 'Invite a member'} faIcon="user-plus" variant="secondary" style={styles.half} disabled={sharing} onPress={() => {
              setInviteCode('');
              setSharing(true);
            }} />
          </>
        ) : null}
        {collection?.role === 'owner' ? <KIBButton
          label={renaming ? (busy ? 'Renaming…' : 'Save name') : 'Rename collection'}
          faIcon={renaming ? 'check' : 'pen'}
          style={styles.half}
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
          faIcon="trash-can"
          style={styles.half}
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
                  safeBack(router, '/collections');
                },
              },
            ]);
          }}
        /> : null}
        <KIBButton label="Back" faIcon="chevron-left" variant="ghost" style={{ width: '100%', height: 44 }} onPress={() => safeBack(router, '/collections')} />
      </View>

      {sharing ? (
        <View style={styles.sharePanel}>
          <Text style={[type.h3, { color: colors.text }]}>Invite to this collection</Text>
          <Text style={{ color: colors.textSecondary, marginTop: spacing.xs }}>Choose what the invitee can do.</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md }}>
            {(collection?.role === 'owner' ? ['viewer', 'editor'] as const : ['viewer'] as const).map((role) => (
              <Pressable key={role} onPress={() => setInviteRole(role)} style={[styles.roleChip, inviteRole === role && { backgroundColor: colors.text }]}>
                <FontAwesomeFreeSolid name={role === 'viewer' ? 'eye' : 'pen'} size={14} color={inviteRole === role ? colors.paper : colors.text} />
                <Text style={{ color: inviteRole === role ? colors.paper : colors.text, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{role === 'viewer' ? 'Viewer · view links' : 'Editor · add or remove links'}</Text>
              </Pressable>
            ))}
          </View>
          {inviteCode ? (
            <>
              <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', fontFamily: fontFamily.bodyMedium }}>One-time code · expires in 7 days</Text>
              <Text selectable style={styles.inviteCode}>{inviteCode}</Text>
              <KIBButton faIcon="share-nodes" label="Share invite code" onPress={() => void Share.share({ message: `Join my KeepItBack collection “${name}”. Open KeepItBack → Collections → Join with code: ${inviteCode}` })} />
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
  sharePanel: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 24, padding: spacing.xl, paddingBottom: spacing.md, borderRadius: 30, backgroundColor: colors.surface, elevation: 12, shadowColor: colors.text, shadowOpacity: 0.28, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } },
  roleChip: { flex: 1, gap: 6, borderRadius: 18, padding: spacing.md, backgroundColor: colors.bg },
  emojiTile: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  sharedBanner: { flexDirection: 'row', gap: 8, marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.sky },
  removeDot: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.errorTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  half: { flexGrow: 1, flexBasis: '45%', height: 46, paddingHorizontal: 10 },
  inviteCode: { marginVertical: spacing.md, paddingVertical: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.sky, textAlign: 'center', fontSize: 21, letterSpacing: 2.5, color: colors.text, fontFamily: fontFamily.bodyStrong, fontWeight: '800' },
});
