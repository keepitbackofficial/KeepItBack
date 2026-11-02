import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { KIBText as Text } from '../src/components/KIBText';
import { KIBButton } from '../src/components/KIBPrimitives';
import { KIBKipScene } from '../src/components/KIBKip';
import { FontAwesomeFreeSolid } from '@react-native-vector-icons/fontawesome-free-solid';
import { colors, spacing, type } from '../src/theme';

/**
 * SCREEN — SHARE INTENT EXPLANATION. Shown when a shared item carried no
 * web link, or its payload could not be read. Purely informational: the
 * global ShareIntentBridge at the root layout makes all routing decisions
 * for share intents, so this screen never consumes the share context.
 */
export default function ShareIntentScreen() {
  const router = useRouter();
  const { reason: reasonParam } = useLocalSearchParams<{ reason?: string | string[] }>();
  const reason = Array.isArray(reasonParam) ? reasonParam[0] : reasonParam;
  const message = reason === 'parse'
    ? 'Could not read the shared content.'
    : 'No web link was found in the shared content.';

  return (
    <View style={styles.container}>
      <KIBKipScene size={200} disc={colors.rose} badge={<FontAwesomeFreeSolid name="question" size={16} color={colors.text} />} />
      <Text style={styles.message}>{message}</Text>
      <KIBButton label="Done" variant="secondary" onPress={() => router.replace('/')} style={{ minWidth: 160 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  message: { ...type.h3, color: colors.text, textAlign: 'center', maxWidth: 300, marginTop: spacing.sm },
});
