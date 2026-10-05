import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../src/theme';

/** Bottom navigation: Home | Search | + Save | Library | Profile (spec §2). */
function SaveTabButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/save')}
      accessibilityRole="button"
      accessibilityLabel="Save a link"
      style={({ pressed }) => [styles.saveFab, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
    >
      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -2 }}>+</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} /> }} />
      <Tabs.Screen
        name="save-placeholder"
        options={{
          title: '',
          tabBarButton: () => <SaveTabButton />,
        }}
      />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color }) => <TabIcon emoji="📚" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
    </Tabs>
  );
}

function TabIcon({ emoji, color }: { emoji: string; color: string | number | symbol }) {
  const active = color === '#FFFFFF' || color === colors.text;
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 18, opacity: active ? 1 : 0.55 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  saveFab: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
