import React from 'react';
import { Image, Modal, Pressable, StyleSheet, TextStyle, View } from 'react-native';
import { KIBText as Text } from './KIBText';
import { KIBPlatformLogo } from './KIBPlatformLogo';
import { KIBMotionPressable } from './KIBPrimitives';
import { colors, radius, spacing, type } from '../theme';
import { Collection, ContentType, Platform, SavedItem } from '../types';

function creatorLabel(item: SavedItem): string {
  return item.creator_handle ?? item.creator_name ?? 'Unknown creator';
}

/** Real preview when available; otherwise a neutral source placeholder, never sample imagery. */
export function KIBThumbnail({
  item,
  height = 110,
  borderRadius = radius.md,
}: {
  item: Pick<SavedItem, 'id' | 'title' | 'platform' | 'content_type' | 'thumbnail_url'>;
  height?: number;
  borderRadius?: number;
}) {
  const vid = ['Video', 'Reel', 'Short'].includes(item.content_type as ContentType);
  return (
    <View style={{ height, borderRadius, overflow: 'hidden', backgroundColor: colors.surface3 }}>
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <KIBPlatformLogo platform={item.platform as Platform} size={height * 0.3} />
          <Text style={{ color: colors.textMuted, fontSize: 10 }} numberOfLines={1}>
            Preview unavailable
          </Text>
        </View>
      )}
      {item.thumbnail_url ? <View style={{ position: 'absolute', top: 6, left: 6 }}><KIBPlatformBadge platform={item.platform as Platform} /></View> : null}
      {vid ? (
        <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(28,23,24,0.78)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{item.content_type}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function KIBPlatformBadge({ platform }: { platform: Platform }) {
  return (
    <View style={styles.badge} accessibilityLabel={`${platform} logo`}>
      <KIBPlatformLogo platform={platform} size={14} />
    </View>
  );
}

/** Main content card — grid variant. */
export function KIBContentCard({ item, onPress, width }: { item: SavedItem; onPress?: () => void; width?: number | `${number}%` }) {
  return (
    <KIBMotionPressable
      enter
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.platform} ${item.content_type}`}
      style={[styles.card, { width: width ?? '100%' }]}
    >
      <KIBThumbnail item={item} height={110} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <KIBPlatformLogo platform={item.platform as Platform} size={13} />
        <Text style={[type.caption as TextStyle, { color: colors.textMuted, marginLeft: 5 }]}>• {item.content_type}</Text>
      </View>
      <Text style={[type.body as TextStyle, { color: colors.text, marginTop: 2 }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[type.caption as TextStyle, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
        {creatorLabel(item)}{item.category ? ` • ${item.category}` : ''}
      </Text>
      {item.local_downloaded ? <Text style={[type.caption as TextStyle, { color: colors.accent, marginTop: 3 }]}>↓ On this device</Text> : null}
    </KIBMotionPressable>
  );
}

/** List variant used in feeds and search results. */
export function KIBContentRow({ item, onPress, keywords }: { item: SavedItem; onPress?: () => void; keywords?: string[] }) {
  return (
    <KIBMotionPressable
      enter
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, flex: 1 }}>
          <KIBPlatformLogo platform={item.platform as Platform} size={12} />
          <Text style={[type.caption as TextStyle, { color: colors.textMuted, marginLeft: 4, flex: 1 }]} numberOfLines={1}>
            • {item.content_type} • {creatorLabel(item)}{item.category ? ` • ${item.category}` : ''}
          </Text>
        </View>
        {keywords && keywords.length > 0 ? (
          <Text style={[type.caption as TextStyle, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={1}>
            {keywords.slice(0, 3).join('  ')}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
      {item.local_downloaded ? <Text style={[type.caption as TextStyle, { color: colors.accent }]}>↓</Text> : null}
      {(item.tags ?? []).length > 0 ? (
        <Text style={[type.caption as TextStyle, { color: colors.textMuted }]} numberOfLines={1}>
          {(item.tags ?? []).slice(0, 2).map((t) => `#${t}`).join(' ')}
        </Text>
      ) : null}
      </View>
    </KIBMotionPressable>
  );
}

export function KIBCollectionCard({ collection, count, onPress }: { collection: Collection; count: number; onPress?: () => void }) {
  return (
    <KIBMotionPressable
      enter
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Collection ${collection.name}, ${count} items`}
      style={styles.collectionCard}
    >
      <Text style={{ fontSize: 24, color: colors.accent }}>{collection.emoji}</Text>
      <Text style={[type.body as TextStyle, { color: colors.text, fontWeight: '600', marginTop: 4 }]} numberOfLines={1}>
        {collection.name}
      </Text>
      <Text style={[type.caption as TextStyle, { color: colors.textMuted }]}>{count} items</Text>
    </KIBMotionPressable>
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
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${collection.name}`} style={styles.collectionRow}>
      <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22 }}>{collection.emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[type.body as TextStyle, { color: colors.text, fontWeight: '600' }]}>{collection.name}</Text>
        <Text style={[type.caption as TextStyle, { color: colors.textMuted }]}>
          {count} item{count === 1 ? '' : 's'}
          {collection.description ? ` • ${collection.description}` : ''}
        </Text>
      </View>
      <Text style={{ color: colors.accent, fontSize: 18 }}>›</Text>
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
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(28,23,24,0.38)', justifyContent: 'flex-end' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,23,24,0.42)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
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
