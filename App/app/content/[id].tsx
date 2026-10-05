import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBBottomSheet, KIBDownloadButton, KIBThumbnail, KIBModal } from '../../src/components/KIBContent';
import { KIBButton, KIBFilterChip, KIBIconButton, KIBTag } from '../../src/components/KIBPrimitives';
import { platformEmoji } from '../../src/lib/platform';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

const QUICK_WHY = ['Watch later', 'Try later', 'Buy later', 'Learn this'];

/** SCREEN 13 — CONTENT DETAILS. */
export default function ContentDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const {
    items, collections, markOpened, setTags, setNote, setWhySaved,
    setItemCollections, deleteItem, deleteLocalCopy, toggleArchived,
  } = useStore();
  const item = items.find((i) => i.id === id);

  const [sheet, setSheet] = useState<null | 'menu' | 'tags' | 'note' | 'collections' | 'why' | 'delete'>(null);
  const [draftTags, setDraftTags] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftWhy, setDraftWhy] = useState('');
  const [alsoLocal, setAlsoLocal] = useState(false);
  const [tagQuery, setTagQuery] = useState('');

  useEffect(() => {
    if (item) markOpened(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const itemCollections = useMemo(
    () => (item ? collections.filter((c) => c.itemIds.includes(item.id)) : []),
    [item, collections],
  );

  if (!item) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={{ color: colors.textMuted }}>Item not found.</Text>
      </View>
    );
  }

  const openOriginal = () => {
    Linking.openURL(item.originalUrl).catch(() => {
      Alert.alert('Link unavailable', 'Original content may no longer be available.');
    });
  };

  const confirmDelete = () => {
    deleteItem(item.id, alsoLocal);
    setSheet(null);
    router.back();
  };

  const suggestedTags = item.aiState === 'done' ? item.aiKeywords : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <KIBIconButton icon="⋮" label="More options" onPress={() => setSheet('menu')} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <KIBThumbnail item={item} height={200} borderRadius={radius.lg} />

        <Text style={[type.h2 as any, { color: colors.text, marginTop: spacing.lg }]}>{item.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
          {platformEmoji[item.platform]} {item.platform} • {item.contentType} • {item.creatorHandle ?? item.creatorName}
        </Text>

        {/* AI Summary */}
        <View style={styles.aiCard}>
          <Text style={{ color: colors.accentSoft, fontWeight: '600', fontSize: 14 }}>
            ✨ {item.aiState === 'pending' ? 'AI processing...' : item.aiState === 'done' ? 'AI Summary' : 'AI unavailable'}
          </Text>
          {item.aiState === 'done' ? (
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 }}>{item.aiSummary}</Text>
          ) : null}
        </View>

        {/* Keywords */}
        {item.aiKeywords.length > 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[type.h3 as any, { color: colors.text, marginBottom: spacing.sm }]}>Keywords</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {item.aiKeywords.map((k) => (
                <KIBTag key={k} label={k} small />
              ))}
            </View>
          </View>
        ) : null}

        {/* Collections */}
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[type.h3 as any, { color: colors.text, marginBottom: spacing.sm }]}>Collection</Text>
          <Pressable onPress={() => setSheet('collections')} style={styles.rowCard} accessibilityLabel="Edit collections">
            {itemCollections.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>+ Add to collection</Text>
            ) : (
              itemCollections.map((c) => (
                <Text key={c.id} style={{ color: colors.text, fontSize: 14 }}>
                  {c.emoji} {c.name}
                </Text>
              ))
            )}
          </Pressable>
        </View>

        {/* Tags */}
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[type.h3 as any, { color: colors.text, marginBottom: spacing.sm }]}>Tags</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {item.tags.map((t) => (
              <KIBTag key={t} label={`#${t}`} small onRemove={() => setTags(item.id, item.tags.filter((x) => x !== t))} />
            ))}
            <KIBFilterChip label="+ Edit Tags" onPress={() => { setDraftTags(''); setSheet('tags'); }} />
          </View>
        </View>

        {/* Note + why */}
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[type.h3 as any, { color: colors.text, marginBottom: spacing.sm }]}>Note</Text>
          <Pressable onPress={() => { setDraftNote(item.note ?? ''); setSheet('note'); }} style={styles.rowCard} accessibilityLabel="Edit note">
            <Text style={{ color: item.note ? colors.text : colors.textMuted, fontSize: 14 }}>
              {item.note || 'Add a note...'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setDraftWhy(item.whySaved ?? ''); setSheet('why'); }} style={[styles.rowCard, { marginTop: spacing.sm }]} accessibilityLabel="Edit why I saved this">
            <Text style={{ color: item.whySaved ? colors.text : colors.textMuted, fontSize: 14 }}>
              {item.whySaved ? `Why saved: ${item.whySaved}` : 'Why I saved this...'}
            </Text>
          </Pressable>
        </View>

        {/* Download */}
        <View style={{ marginTop: spacing.lg }}>
          <KIBDownloadButton item={item} />
          {item.downloadState === 'unsupported' ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
              Your KeepItBack bookmark is still saved. Open the original to view it.
            </Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <KIBButton label="Open Original" variant="secondary" onPress={openOriginal} style={{ flex: 1 }} />
          <KIBButton label="Share" variant="secondary" onPress={() => Alert.alert('Share', 'Share this saved item from your library.')} style={{ flex: 1 }} />
        </View>
      </ScrollView>

      {/* More menu */}
      <KIBBottomSheet visible={sheet === 'menu'} onClose={() => setSheet(null)} title={item.title}>
        {[
          { label: 'Add to Collection', fn: () => setSheet('collections') },
          { label: 'Edit Tags', fn: () => setSheet('tags') },
          { label: 'Add Note', fn: () => setSheet('note') },
          { label: 'Why I Saved This', fn: () => setSheet('why') },
          { label: item.isArchived ? 'Unarchive' : 'Archive', fn: () => { toggleArchived(item.id); setSheet(null); } },
          { label: 'Delete', fn: () => setSheet('delete'), danger: true },
        ].map((row) => (
          <Pressable key={row.label} onPress={row.fn} style={styles.menuRow} accessibilityRole="button" accessibilityLabel={row.label}>
            <Text style={{ color: row.danger ? colors.error : colors.text, fontSize: 15 }}>{row.label}</Text>
          </Pressable>
        ))}
      </KIBBottomSheet>

      {/* Edit tags */}
      <KIBBottomSheet
        visible={sheet === 'tags'}
        onClose={() => setSheet(null)}
        title="Tags"
        footer={<KIBButton label="Done" onPress={() => setSheet(null)} />}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {item.tags.map((t) => (
            <KIBTag key={t} label={`#${t}`} onRemove={() => setTags(item.id, item.tags.filter((x) => x !== t))} />
          ))}
        </View>
        <TextInput
          value={tagQuery}
          onChangeText={setTagQuery}
          onSubmitEditing={() => {
            const t = tagQuery.trim().replace(/^#/, '').toLowerCase();
            if (t && !item.tags.includes(t)) setTags(item.id, [...item.tags, t]);
            setTagQuery('');
          }}
          placeholder="Add a tag..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          style={styles.input}
          accessibilityLabel="Add tag"
        />
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm }}>Suggested</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {suggestedTags.filter((s) => !item.tags.includes(s.toLowerCase())).map((s) => (
            <KIBFilterChip key={s} label={s} onPress={() => setTags(item.id, [...item.tags, s.toLowerCase()])} />
          ))}
        </View>
      </KIBBottomSheet>

      {/* Note */}
      <KIBBottomSheet
        visible={sheet === 'note'}
        onClose={() => setSheet(null)}
        title="Note"
        footer={
          <KIBButton
            label="Save Note"
            onPress={() => {
              setNote(item.id, draftNote.trim());
              setSheet(null);
            }}
          />
        }
      >
        <TextInput value={draftNote} onChangeText={setDraftNote} multiline placeholder="Add a note about this..." placeholderTextColor={colors.textMuted} style={[styles.input, { minHeight: 80 }]} accessibilityLabel="Note" />
      </KIBBottomSheet>

      {/* Why I saved this */}
      <KIBBottomSheet
        visible={sheet === 'why'}
        onClose={() => setSheet(null)}
        title="Why did you save this?"
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <KIBButton label="Skip" variant="ghost" style={{ flex: 1 }} onPress={() => setSheet(null)} />
            <KIBButton
              label="Save"
              style={{ flex: 1 }}
              onPress={() => {
                setWhySaved(item.id, draftWhy.trim());
                setSheet(null);
              }}
            />
          </View>
        }
      >
        <TextInput value={draftWhy} onChangeText={setDraftWhy} placeholder="Example: Try this restaurant" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Why I saved this" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg }}>
          {QUICK_WHY.map((w) => (
            <KIBFilterChip key={w} label={w} active={draftWhy === w} onPress={() => setDraftWhy(w)} />
          ))}
        </View>
      </KIBBottomSheet>

      {/* Add to collection */}
      <KIBBottomSheet
        visible={sheet === 'collections'}
        onClose={() => setSheet(null)}
        title="Add to Collection"
        footer={
          <View style={{ gap: spacing.md }}>
            <KIBButton label="+ Create Collection" variant="secondary" onPress={() => { setSheet(null); router.push('/collections/create'); }} />
            <KIBButton label="Done" onPress={() => setSheet(null)} />
          </View>
        }
      >
        {collections.map((c) => {
          const checked = c.itemIds.includes(item.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => setItemCollections(item.id, checked ? c.itemIds.filter((x) => x !== item.id) : [...c.itemIds, item.id])}
              style={styles.menuRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`${checked ? 'Remove from' : 'Add to'} ${c.name}`}
            >
              <Text style={{ fontSize: 15, marginRight: 12, color: colors.accentSoft }}>{checked ? '☑' : '☐'}</Text>
              <Text style={{ fontSize: 15, marginRight: 8 }}>{c.emoji}</Text>
              <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{c.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.itemIds.length}</Text>
            </Pressable>
          );
        })}
      </KIBBottomSheet>

      {/* Delete confirmation (spec §43) */}
      <KIBModal visible={sheet === 'delete'} onClose={() => setSheet(null)} title="Delete saved item?">
        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
          This will remove it from your KeepItBack library.
        </Text>
        {item.downloadState === 'downloaded' ? (
          <Pressable
            onPress={() => setAlsoLocal(!alsoLocal)}
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: alsoLocal }}
          >
            <Text style={{ fontSize: 16, marginRight: 8, color: alsoLocal ? colors.accentSoft : colors.textMuted }}>
              {alsoLocal ? '☑' : '☐'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Also delete downloaded copy</Text>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
          <KIBButton label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setSheet(null)} />
          <KIBButton label="Delete" variant="danger" style={{ flex: 1 }} onPress={confirmDelete} />
        </View>
      </KIBModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  aiCard: {
    backgroundColor: 'rgba(124,92,252,0.1)',
    borderColor: 'rgba(124,92,252,0.35)',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  rowCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  input: {
    backgroundColor: colors.surface2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
});
