import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { ActivityIndicator, View } from 'react-native';
import { KIBTabBar } from '../../src/components/KIBTabBar';
import { colors } from '../../src/theme';

/** Bottom navigation: Home | Search | + Save | Library | Profile (spec §2). */
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
      tabBar={(props) => <KIBTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      {/* Placeholder tab slot: the center + button routes to the /save modal
          directly, so this screen is never displayed. */}
      <Tabs.Screen name="save-placeholder" options={{ title: '' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="profile" options={{ title: 'You' }} />
    </Tabs>
  );
}
