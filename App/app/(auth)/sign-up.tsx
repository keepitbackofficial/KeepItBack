import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

/** SCREEN 06 — CREATE ACCOUNT (mock; Clerk adapter point). */
export default function SignUp() {
  const router = useRouter();
  const { signIn, updateProfile } = useStore();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [taken, setTaken] = useState<boolean | null>(null);
  const insets = useSafeAreaInsets();

  // Async username availability check (spec §9)
  useEffect(() => {
    if (username.length < 3) {
      setTaken(null);
      return;
    }
    setTaken(null);
    const t = setTimeout(() => setTaken(['ayaz', 'admin', 'keepitback'].includes(username.toLowerCase())), 500);
    return () => clearTimeout(t);
  }, [username]);

  const submit = () => {
    updateProfile({
      displayName: name.trim() || 'You',
      username: username.trim() || 'user',
      email: email.trim() || 'you@example.com',
    });
    signIn();
    router.replace('/(tabs)/home');
  };

  const canSubmit = name.trim().length > 1 && username.trim().length >= 3 && taken === false;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={[type.h1 as any, { color: colors.text }]}>Create Account</Text>
      <Text style={[type.secondary as any, { color: colors.textSecondary, marginTop: spacing.sm }]}>
        Your library is private by default.
      </Text>

      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        <View>
          <Text style={styles.label}>Display name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Ayaz" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Display name" />
        </View>
        <View>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="ayaz"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Username"
          />
          {username.length >= 3 && taken !== null ? (
            <Text style={{ color: taken ? colors.error : colors.success, fontSize: 12, marginTop: 4 }}>
              {taken ? 'That username is taken' : '@' + username.toLowerCase() + ' is available ✓'}
            </Text>
          ) : null}
        </View>
        <View>
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Email" />
        </View>
      </View>

      <View style={{ flex: 1 }} />
      <KIBButton label="Create Account" onPress={submit} disabled={!canSubmit} />
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <KIBButton label="Continue with Google" icon="🌐" variant="secondary" onPress={submit} />
        <KIBButton label="Continue with Apple" icon="🍎" variant="secondary" onPress={submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
  },
});
