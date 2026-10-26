import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import { paletteFor, colors, radius, spacing, type } from '../theme';
import { platformColor, platformEmoji } from '../lib/platform';
import { Collection, ContentType, Platform, SavedItem } from '../types';

/** Gradient-ish thumbnail placeholder + platform badge. */
export function KIBThumbnail({
  item,
  height = 110,
  borderRadius = radius.md,
}: {
  item: Pick<SavedItem, 'id' | 'title' | 'platform' | 'content_type'>;
  height?: number;
  borderRadius?: number;
}) {
  const [from, to] = paletteFor(item.id + item.title);
  const vid = ['Video', 'Reel', 'Short'].includes(item.content_type as ContentType);
  return (
    <View style={{ height, borderRadius, overflow: 'hidden', backgroundColor: from }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: to, opacity: 0.35 }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: height * 0.34 }}>{platformEmoji[item.platform as Platform]}</Text>
      </View>
      <View style={{ position: 'absolute', top: 6, left: 6 }}>
        <KIBPlatformBadge platform={item.platform as Platform} />
      </View>
      {vid ? (
        <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{item.content_type === 'Video' ? '▶' : '⚡'}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function KIBPlatformBadge({ platform, withLabel }: { platform: Platform; withLabel?: boolean }) {
  return (
    <View style={[styles.badge, withLabel && { paddingHorizontal: 8, flexDirection: 'row', gap: 4 }]}>
      <Text style={{ fontSize: withLabel ? 11 : 13 }}>{platformEmoji[platform]}</Text>
      {withLabel ? <Text style={{ color: '#fff', fontSize: 11 }}>{platform}</Text> : null}
    </View>
  );
}

/** Main content card — grid variant. */
export function KIBContentCard({ item, onPress, width }: { item: SavedItem; onPress?: () => void; width?: number | `${number}%` }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.platform} ${item.content_type}`}
      style={[styles.card, { width: width ?? '100%' }]}
    >
      <KIBThumbnail item={item} height={110} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <Text style={[type.caption as TextStyle, { color: platformColor[item.platform as Platform] }]}>{item.platform}</Text>
        <Text style={[type.caption as TextStyle, { color: colors.textMuted }]}> • {item.content_type}</Text>
      </View>
      <Text style={[type.body as TextStyle, { color: colors.text, marginTop: 2 }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[type.caption as TextStyle, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
        {item.creator_handle ?? item.creator_name ?? 'Unknown creator'}
      </Text>
    </Pressable>
  );
}

/** List variant used in feeds and search results. */
export function KIBContentRow({ item, onPress, keywords }: { item: SavedItem; onPress?: () => void; keywords?: string[] }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.platform} ${item.content_type}`}
      style={styles.row}
    >
      <View style={{ width: 92 }}>
        <KIBThumbnail item={item} height={68} borderRadius={radius.sm} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[type.body as TextStyle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[type.caption as TextStyle, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {item.platform} • {item.content_type} • {item.creator_handle ?? item.creator_name ?? 'Unknown creator'}
        </Text>
        {keywords && keywords.length > 0 ? (
          <Text style={[type.caption as TextStyle, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={1}>
            {keywords.slice(0, 3).join('  ')}
          </Text>
        ) : null}
      </View>
      {(item.tags ?? []).length > 0 ? (
        <Text style={[type.caption as TextStyle, { color: colors.textMuted }]} numberOfLines={1}>
          {(item.tags ?? []).slice(0, 2).map((t) => `#${t}`).join(' ')}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function KIBCollectionCard({ collection, count, onPress }: { collection: Collection; count: number; onPress?: () => void }) {
  const [from, to] = paletteFor(collection.id + collection.name);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Collection ${collection.name}, ${count} items`}
      style={[styles.collectionCard, { backgroundColor: from }]}
    >
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: to, opacity: 0.25 }} />
      <Text style={{ fontSize: 24 }}>{collection.emoji}</Text>
      <Text style={[type.body as TextStyle, { color: '#fff', fontWeight: '600', marginTop: 4 }]} numberOfLines={1}>
        {collection.name}
      </Text>
      <Text style={[type.caption as TextStyle, { color: 'rgba(255,255,255,0.7)' }]}>{count} items</Text>
    </Pressable>
  );
}

/** Collection row for the collections list screen. */
export function KIBCollectionRow({
  collection,
  count,
  onPress,
}: {
  collection: Collection;
  count: number;
  onPress?: () => void;
}) {
  const [from, to] = paletteFor(collection.id + collection.name);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${collection.name}`} style={styles.collectionRow}>
      <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: from, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: to, opacity: 0.25 }} />
        <Text style={{ fontSize: 22 }}>{collection.emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[type.body as TextStyle, { color: colors.text, fontWeight: '600' }]}>{collection.name}</Text>
        <Text style={[type.caption as TextStyle, { color: colors.textMuted }]}>
          {count} item{count === 1 ? '' : 's'}
          {collection.description ? ` • ${collection.description}` : ''}
        </Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

/** Generic bottom sheet. */
export function KIBBottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose} accessibilityLabel="Close sheet">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={[type.h3 as TextStyle, { color: colors.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <Text style={{ color: colors.textMuted, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
          <View style={{ maxHeight: 480 }}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.sm,
    padding: 4,
  },
  collectionCard: {
    width: 140,
    height: 100,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.modal,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
