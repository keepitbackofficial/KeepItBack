import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from '../src/store/useStore';
import { colors } from '../src/theme';

export default function RootLayout() {
  useStore((s) => s.hydrated);
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="save" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="content/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="collections/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
