import { Redirect, Tabs, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { ComponentProps } from 'react';
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
      <FontAwesomeFreeSolid name="plus" size={24} color="#fff" />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

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
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon icon="house" color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color }) => <TabIcon icon="magnifying-glass" color={color} /> }} />
      {/* Placeholder tab slot: the center + button routes to the /save modal
          directly, so this screen is never displayed. */}
      <Tabs.Screen
        name="save-placeholder"
        options={{
          title: '',
          tabBarButton: () => <SaveTabButton />,
        }}
      />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color }) => <TabIcon icon="book" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ color }) => <TabIcon icon="user" color={color} /> }} />
    </Tabs>
  );
}

function TabIcon({ icon, color }: { icon: ComponentProps<typeof FontAwesomeFreeSolid>['name']; color?: string | number | symbol | null }) {
  const active = color === '#FFFFFF' || color === colors.text;
  return (
    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <FontAwesomeFreeSolid name={icon} size={20} color={typeof color === 'string' ? color : colors.text} style={{ opacity: active ? 1 : 0.55 }} />
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
