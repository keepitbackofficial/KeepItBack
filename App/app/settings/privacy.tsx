import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';
import { KIBText as Text } from '../../src/components/KIBText';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchProfile, updateAnalyticsPreference } from '../../src/api/profile';
import { deleteCloudAccount, exportAccountData } from '../../src/api/privacy';
import { clearLocalUserData, getDownloads } from '../../src/lib/localStore';
import { deleteDownloadedMedia } from '../../src/lib/downloads';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { KIBPlatformLogo } from '../../src/components/KIBPlatformLogo';
import { colors, radius, spacing, type } from '../../src/theme';

export default function PrivacySettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, signOut } = useAuth();
  const [analytics, setAnalytics] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void fetchProfile(userId).then((result) => setAnalytics(Boolean(result.data?.analytics_opt_in)));
  }, [userId]);

  const exportData = async () => {
    if (!userId) return;
    setBusy(true);
    const result = await exportAccountData(userId);
    setBusy(false);
    if (result.error) Alert.alert('Export unavailable', result.error);
  };

  const deleteAccount = () => Alert.alert(
    'Delete your account?',
    'This permanently deletes your KeepItBack account, cloud library, notes, tags, collections, and shared memberships. Device downloads will also be removed. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: async () => {
        if (!userId) return;
        setBusy(true);
        const result = await deleteCloudAccount();
        if (result.error) {
          setBusy(false);
          Alert.alert('Account deletion failed', result.error);
          return;
        }
        try {
          const downloads = await getDownloads(userId);
          for (const download of downloads) await deleteDownloadedMedia(userId, download.item_id);
          await clearLocalUserData(userId);
        } catch {
          // The cloud account is already removed; local database may be unavailable on this build.
        }
        try { await signOut(); } catch { /* The account may already have been removed server-side. */ }
        setBusy(false);
        router.replace('/(auth)/sign-in');
      } },
    ],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={[type.h2 as any, { color: colors.text }]}>Privacy & data</Text>
      <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Export a copy of your account data or permanently remove the account and its cloud records.</Text>
      <View style={styles.card}>
        <Text style={[type.label as any, { color: colors.text }]}>Product analytics</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>Optional first-party event counts only. Saved URLs, notes, tags, and media are never recorded.</Text>
        <Switch value={analytics} onValueChange={async (value) => {
          if (!userId) return;
          setAnalytics(value);
          const result = await updateAnalyticsPreference(userId, value);
          if (result.error) {
            setAnalytics(!value);
            Alert.alert('Could not save preference', result.error);
          }
        }} trackColor={{ false: colors.border, true: colors.accentSoft }} thumbColor={analytics ? colors.accent : colors.surface} />
      </View>
      <View style={[styles.card, { marginTop: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <KIBPlatformLogo platform="Instagram" size={16} />
          <Text style={[type.label as any, { color: colors.text }]}>Link previews</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          Public Instagram URLs you enter or share are sent to Microlink to request a cover, title, and creator name. Your private notes and tags are not sent. Instagram may not provide preview data for every link.
        </Text>
      </View>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <KIBButton label={busy ? 'Working…' : 'Export my data'} variant="secondary" disabled={busy} onPress={() => void exportData()} />
        <KIBButton label={busy ? 'Working…' : 'Delete my account'} variant="danger" disabled={busy} onPress={deleteAccount} />
        <KIBButton label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: spacing.lg }}>Exports include your saved link metadata, private notes and tags, collections, memberships, and connected account records. Device media is not uploaded to the cloud export.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  card: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
});
