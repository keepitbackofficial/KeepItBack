import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, TextStyle, View } from 'react-native';
import { KIBText as Text } from './KIBText';
import { KIBPlatformLogo } from './KIBPlatformLogo';
import { KIBMotionPressable } from './KIBPrimitives';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, fontFamily, radius, spacing, type } from '../theme';
import { Collection, ContentType, Platform, SavedItem } from '../types';
import { fetchLinkMetadata } from '../api/linkMetadata';
import { updateItem } from '../api/items';
import { useLibrary } from '../store/useLibrary';

function creatorLabel(item: SavedItem): string {
  return item.creator_handle ?? item.creator_name ?? 'Unknown creator';
}

const thumbnailRefreshes = new Map<string, Promise<string | null>>();

function refreshInstagramThumbnail(item: SavedItem): Promise<string | null> {
  const itemId = item.remote_id ?? item.id;
  if (itemId.startsWith('local:')) return Promise.resolve(null);
  const active = thumbnailRefreshes.get(itemId);
  if (active) return active;

  let request: Promise<string | null>;
  request = fetchLinkMetadata(item.original_url, { force: true }).then(async (metadata) => {
    const thumbnailUrl = metadata?.thumbnail_url;
    if (!thumbnailUrl || thumbnailUrl === item.thumbnail_url) return null;
    const result = await updateItem(itemId, { thumbnail_url: thumbnailUrl });
    if ('error' in result) return thumbnailUrl;
    void useLibrary.getState().loadItems({ force: true });
    return thumbnailUrl;
  }).catch(() => null).finally(() => {
    if (thumbnailRefreshes.get(itemId) === request) thumbnailRefreshes.delete(itemId);
  });
  thumbnailRefreshes.set(itemId, request);
  return request;
}

/** Real preview when available; otherwise a neutral source placeholder, never sample imagery. */
export function KIBThumbnail({
  item,
  height = 110,
  borderRadius = radius.md,
}: {
  item: SavedItem;
  height?: number;
  borderRadius?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [refreshedUrl, setRefreshedUrl] = useState<string | null>(null);
  const [refreshAttemptedFor, setRefreshAttemptedFor] = useState<string | null>(null);
  const thumbnailUrl = refreshedUrl ?? item.thumbnail_url ?? null;
  const showImage = Boolean(thumbnailUrl && failedUrl !== thumbnailUrl);
  const itemId = item.remote_id ?? item.id;

  const handleImageError = () => {
    if (!thumbnailUrl) return;
    setFailedUrl(thumbnailUrl);
    if (item.platform !== 'Instagram' || refreshAttemptedFor === itemId) return;
    setRefreshAttemptedFor(itemId);
    void refreshInstagramThumbnail(item).then((nextUrl) => {
      if (nextUrl && nextUrl !== thumbnailUrl) setRefreshedUrl(nextUrl);
    });
  };

  const vid = ['Video', 'Reel', 'Short'].includes(item.content_type as ContentType);
  // The platform brand mark only appears once the video is actually on this
  // device (V4): while the saved link is not downloaded, no logo is shown.
  const showPlatform = Boolean(item.local_downloaded);
  return (
    <View style={{ height, borderRadius, overflow: 'hidden', backgroundColor: colors.surface3 }}>
      {showImage ? (
        <Image source={{ uri: thumbnailUrl! }} resizeMode="cover" onError={handleImageError} style={{ width: '100%', height: '100%' }} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {showPlatform ? <KIBPlatformLogo platform={item.platform as Platform} size={height * 0.3} /> : null}
          <Text style={{ color: colors.textMuted, fontSize: 10 }} numberOfLines={1}>
            Preview unavailable
          </Text>
        </View>
      )}
      {showImage && showPlatform ? <View style={{ position: 'absolute', bottom: 6, left: 6 }}><KIBPlatformBadge platform={item.platform as Platform} /></View> : null}
      {vid ? (
        <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(28,23,24,0.74)', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 }}>
          <Text style={{ color: colors.paper, fontSize: 10, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }}>{item.content_type}</Text>
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
        {item.local_downloaded ? <KIBPlatformLogo platform={item.platform as Platform} size={13} /> : null}
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
      <View style={{ width: 72 }}>
        <KIBThumbnail item={item} height={72} borderRadius={radius.md} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[type.body as TextStyle, { color: colors.text, fontFamily: fontFamily.bodyStrong, fontWeight: '700', lineHeight: 20 }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
          {item.local_downloaded ? <KIBPlatformLogo platform={item.platform as Platform} size={12} /> : null}
          <Text style={[type.caption as TextStyle, { color: colors.textMuted, marginLeft: 6, flex: 1, fontWeight: '500' }]} numberOfLines={1}>
            {creatorLabel(item)}{item.category ? `  ·  ${item.category}` : ''}
          </Text>
        </View>
        {keywords && keywords.length > 0 ? (
          <Text style={[type.caption as TextStyle, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={1}>
            {keywords.slice(0, 3).join('  ')}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
      {item.local_downloaded ? <FontAwesomeFreeSolid name="download" size={12} color={colors.text} accessibilityLabel="Video on this device" /> : null}
      {(item.tags ?? []).length > 0 ? (
        <Text style={[type.caption as TextStyle, { color: colors.text, fontFamily: fontFamily.bodyStrong }]} numberOfLines={1}>
          {(item.tags ?? []).slice(0, 2).map((t) => `#${t}`).join(' ')}
        </Text>
      ) : null}
      </View>
    </KIBMotionPressable>
  );
}

const TILE_COLORS = [colors.sky, colors.rose, colors.paper];
function tileIndex(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % TILE_COLORS.length;
}

export function KIBCollectionCard({ collection, count, onPress }: { collection: Collection; count: number; onPress?: () => void }) {
  return (
    <KIBMotionPressable
      enter
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Collection ${collection.name}, ${count} items`}
      style={[styles.collectionCard, { backgroundColor: TILE_COLORS[tileIndex(collection.id)] }]}
    >
      <View style={styles.emojiTile}><Text style={{ fontSize: 22 }}>{collection.emoji}</Text></View>
      <View>
        <Text style={[type.body as TextStyle, { color: colors.text, fontFamily: fontFamily.bodyStrong, fontWeight: '700', lineHeight: 19 }]} numberOfLines={2}>
          {collection.name}
        </Text>
        <Text style={[type.caption as TextStyle, { color: colors.textSecondary, fontWeight: '500' }]}>{count} items</Text>
      </View>
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
    <KIBMotionPressable enter onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${collection.name}`} style={styles.collectionRow}>
      <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: TILE_COLORS[tileIndex(collection.id)], overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 24 }}>{collection.emoji}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={[type.body as TextStyle, { color: colors.text, fontFamily: fontFamily.bodyStrong, fontWeight: '700' }]}>{collection.name}</Text>
        <Text style={[type.caption as TextStyle, { color: colors.textMuted, fontWeight: '500' }]}>
          {count} item{count === 1 ? '' : 's'}
          {collection.description ? ` • ${collection.description}` : ''}
        </Text>
      </View>
      <FontAwesomeFreeSolid name="chevron-right" size={14} color={colors.textMuted} />
    </KIBMotionPressable>
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
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close" style={styles.sheetClose}>
              <FontAwesomeFreeSolid name="xmark" size={14} color={colors.text} />
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
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(28,23,24,0.74)',
    borderRadius: 7,
    padding: 4,
  },
  collectionCard: {
    width: 138,
    height: 150,
    borderRadius: radius.lg,
    padding: 14,
    marginRight: spacing.sm,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  emojiTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,250,248,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetOverlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    padding: 22,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(28,23,24,0.18)',
    marginBottom: spacing.lg,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
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
