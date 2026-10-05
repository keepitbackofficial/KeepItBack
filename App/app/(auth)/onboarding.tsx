import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

const SLIDES = [
  {
    emoji: '📥',
    title: 'Save anything.',
    body: 'Save Reels, Shorts, posts, images, articles and links from the apps you already use.',
    legal: undefined as string | undefined,
  },
  {
    emoji: '🔍',
    title: 'Find it later.',
    body: 'Search your entire saved library using keywords or natural language.',
    legal: undefined,
  },
  {
    emoji: '⬇️',
    title: 'Keep it offline.',
    body: 'Save supported content directly to your device for offline access.',
    legal: 'Downloads are available only for content that can be legally and technically downloaded.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const setOnboarded = useStore((s) => s.setOnboarded);
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const finish = () => {
    setOnboarded();
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width))}
        renderItem={({ item }) => (
          <View style={{ width: Dimensions.get('window').width, padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <View style={styles.visual}>
              <Text style={{ fontSize: 72 }}>{item.emoji}</Text>
            </View>
            <Text style={[type.display as any, { color: colors.text, textAlign: 'center', marginTop: spacing.xxl }]}>{item.title}</Text>
            <Text style={[type.body as any, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 22 }]}>
              {item.body}
            </Text>
            {item.legal ? (
              <Text style={[type.caption as any, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' }]}>
                {item.legal}
              </Text>
            ) : null}
          </View>
        )}
      />
      <View style={{ paddingHorizontal: spacing.xl }}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={finish} hitSlop={10} accessibilityLabel="Skip onboarding">
          <Text style={{ color: colors.textMuted, textAlign: 'center', padding: spacing.md }}>Skip</Text>
        </Pressable>
        <KIBButton
          label={page === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          onPress={() => (page === SLIDES.length - 1 ? finish() : listRef.current?.scrollToOffset({ offset: (page + 1) * Dimensions.get('window').width }))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  visual: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 20 },
});
