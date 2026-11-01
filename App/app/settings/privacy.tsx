import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';
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
import { safeBack } from '../../src/lib/navigation';

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
        try { await signOut('local'); } catch { /* The account may already have been removed server-side. */ }
        setBusy(false);
        router.replace('/(auth)/sign-in');
      } },
    ],
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
      <Text style={[type.title, { color: colors.text }]}>Privacy & data</Text>
      <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>Export a copy of your account data or permanently remove the account and its cloud records.</Text>
      <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.label, { color: colors.text }]}>Product analytics</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>Optional first-party event counts only. Saved URLs, notes, tags, and media are never recorded.</Text>
        </View>
        <Switch accessibilityLabel="Product analytics" value={analytics} onValueChange={async (value) => {
          if (!userId) return;
          setAnalytics(value);
          const result = await updateAnalyticsPreference(userId, value);
          if (result.error) {
            setAnalytics(!value);
            Alert.alert('Could not save preference', result.error);
          }
        }} trackColor={{ false: 'rgba(28,23,24,0.14)', true: colors.text }} thumbColor={colors.paper} ios_backgroundColor="rgba(28,23,24,0.14)" />
      </View>
      <View style={[styles.card, { marginTop: spacing.md }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <KIBPlatformLogo platform="Instagram" size={16} />
          <Text style={[type.label, { color: colors.text }]}>Link previews</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
          Public Instagram URLs you enter or share are sent to Microlink to request a cover, title, and creator name. Your private notes and tags are not sent. Instagram may not provide preview data for every link.
        </Text>
      </View>
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <KIBButton label={busy ? 'Working…' : 'Export my data'} faIcon="download" variant="secondary" disabled={busy} onPress={() => void exportData()} />
        <KIBButton label={busy ? 'Working…' : 'Delete my account'} faIcon="trash-can" variant="danger" disabled={busy} onPress={deleteAccount} />
        <KIBButton label="Back" faIcon="chevron-left" variant="ghost" onPress={() => safeBack(router, '/settings')} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.md }}>Exports include your saved link metadata, private notes and tags, collections, memberships, and connected account records. Device media is not uploaded to the cloud export.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  card: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.sm },
});
