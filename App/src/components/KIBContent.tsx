import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { paletteFor, colors, radius, spacing, type } from '../theme';
import { platformColor, platformEmoji } from '../lib/platform';
import { Collection, SavedItem } from '../types';
import { useStore } from '../store/useStore';
import { KIBFilterChip } from './KIBPrimitives';

/** Gradient-ish thumbnail placeholder + platform badge. */
export function KIBThumbnail({ item, height = 110, borderRadius = radius.md }: { item: SavedItem; height?: number; borderRadius?: number }) {
  const [from, to] = paletteFor(item.id + item.title);
  return (
    <View style={{ height, borderRadius, overflow: 'hidden', backgroundColor: from }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: to, opacity: 0.35 }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: height * 0.34 }}>{item.emoji}</Text>
      </View>
      <View style={{ position: 'absolute', top: 6, left: 6 }}>
        <KIBPlatformBadge platform={item.platform} />
      </View>
      {item.contentType === 'Video' || item.contentType === 'Reel' || item.contentType === 'Short' ? (
        <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>{item.contentType === 'Reel' || item.contentType === 'Short' ? '⚡' : '▶'}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function KIBPlatformBadge({ platform, withLabel }: { platform: SavedItem['platform']; withLabel?: boolean }) {
  return (
    <View style={[styles.badge, withLabel && { paddingHorizontal: 8, flexDirection: 'row', gap: 4 }]}>
      <Text style={{ fontSize: withLabel ? 11 : 13 }}>{platformEmoji[platform]}</Text>
      {withLabel ? <Text style={{ color: '#fff', fontSize: 11 }}>{platform}</Text> : null}
    </View>
  );
}

/** Main content card (spec §41) — grid variant. */
export function KIBContentCard({ item, onPress, width }: { item: SavedItem; onPress?: () => void; width?: number | `${number}%` }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.platform} ${item.contentType}`}
      style={[styles.card, { width: width ?? '100%' }]}
    >
      <KIBThumbnail item={item} height={110} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <Text style={[type.caption as TextStyle, { color: platformColor[item.platform] }]}>{item.platform}</Text>
        <Text style={[type.caption as TextStyle, { color: colors.textMuted }]}> • {item.contentType}</Text>
        {item.downloadState === 'downloaded' ? (
          <Text style={[type.caption as TextStyle, { color: colors.success, marginLeft: 'auto' }]}>✓</Text>
        ) : null}
      </View>
      <Text style={[type.body as TextStyle, { color: colors.text, marginTop: 2 }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[type.caption as TextStyle, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
        {item.creatorHandle ?? item.creatorName}
      </Text>
    </Pressable>
  );
}

/** List variant used in search results (spec §12). */
export function KIBContentRow({ item, onPress, keywords }: { item: SavedItem; onPress?: () => void; keywords?: string[] }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.platform} ${item.contentType}`}
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
          {item.platform} • {item.contentType} • {item.creatorHandle ?? item.creatorName}
        </Text>
        {keywords && keywords.length > 0 ? (
          <Text style={[type.caption as TextStyle, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={1}>
            {keywords.slice(0, 3).map((k) => `#${k.toLowerCase()}`).join('  ')}
          </Text>
        ) : null}
      </View>
      {item.downloadState === 'downloaded' ? (
        <Text style={[type.caption as TextStyle, { color: colors.success }]}>✓ Offline</Text>
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
export function KIBCollectionRow({ collection, count, onPress }: { collection: Collection; count: number; onPress?: () => void }) {
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

/** Download button states (spec §49). */
export function KIBDownloadButton({ item, compact }: { item: SavedItem; compact?: boolean }) {
  const startDownload = useStore((s) => s.startDownload);
  const cancelDownload = useStore((s) => s.cancelDownload);

  if (item.downloadState === 'downloaded') {
    return (
      <View style={[styles.downloadDone, compact && { height: 40 }]}>
        <Text style={{ color: colors.success, fontSize: 13, fontWeight: '600' }}>✓ Available Offline</Text>
      </View>
    );
  }
  if (item.downloadState === 'unsupported') {
    return (
      <View style={[styles.downloadDone, { backgroundColor: colors.surface2 }, compact && { height: 40 }]}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>Download unavailable</Text>
      </View>
    );
  }
  if (item.downloadState === 'downloading') {
    return (
      <View style={[styles.downloadActive, compact && { height: 40 }]}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Downloading {Math.round(item.downloadProgress * 100)}%</Text>
        <Pressable onPress={() => cancelDownload(item.id)} hitSlop={6} accessibilityLabel="Cancel download">
          <Text style={{ color: colors.error, fontSize: 13 }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <KIBFilterChip
      label={compact ? 'Save to Device' : '↓ Save to Device'}
      onPress={() => startDownload(item.id)}
      active
    />
  );
}

/** Generic bottom sheet (spec KIBBottomSheet). */
export function KIBBottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
          {footer ? <View style={{ marginTop: spacing.lg }}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Centered modal (spec KIBModal). */
export function KIBModal({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          {title ? (
            <Text style={[type.h3 as TextStyle, { color: colors.text, marginBottom: spacing.md }]}>{title}</Text>
          ) : null}
          {children}
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
  downloadDone: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: 'rgba(53,208,127,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(53,208,127,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  downloadActive: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
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
