import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KIBAvatar, KIBButton, KIBIconButton } from '../../src/components/KIBPrimitives';
import { useStore } from '../../src/store/useStore';
import { colors, radius, spacing, type } from '../../src/theme';

/** SCREEN 25 — EDIT PROFILE. */
export default function EditProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useStore();
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [taken, setTaken] = useState(false);

  useEffect(() => {
    if (username.toLowerCase() === profile.username.toLowerCase()) {
      setTaken(false);
      return;
    }
    const t = setTimeout(() => setTaken(['ayaz', 'admin'].includes(username.toLowerCase())), 500);
    return () => clearTimeout(t);
  }, [username, profile.username]);

  const canSave = name.trim().length > 1 && username.trim().length >= 3 && !taken;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <KIBIconButton icon="←" label="Go back" onPress={() => router.back()} />
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ padding: spacing.xl, flex: 1 }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <KIBAvatar name={name || profile.displayName} size={84} />
          <Text style={{ color: colors.accentSoft, fontSize: 13, marginTop: spacing.sm }}>Change photo</Text>
        </View>

        <Text style={styles.label}>Display name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} accessibilityLabel="Display name" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Username</Text>
        <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" style={styles.input} accessibilityLabel="Username" placeholderTextColor={colors.textMuted} />
        {taken ? <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>That username is taken</Text> : null}

        <Text style={styles.label}>Bio</Text>
        <TextInput value={bio} onChangeText={setBio} multiline style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} accessibilityLabel="Bio" placeholderTextColor={colors.textMuted} placeholder="A few words about you" />

        <View style={{ flex: 1 }} />
        <KIBButton
          label="Save Changes"
          disabled={!canSave}
          onPress={() => {
            updateProfile({ displayName: name.trim(), username: username.trim().toLowerCase(), bio: bio.trim() || undefined });
            router.back();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: spacing.lg },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
});
