import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/expo';
import { KIBButton } from '../../src/components/KIBPrimitives';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SCREEN — SIGN UP. Real Clerk email/password registration with the
 * instance's email-code verification flow (@clerk/expo v4 resource API).
 */
export default function SignUp() {
  const router = useRouter();
  const { shareUrl: shareUrlParam } = useLocalSearchParams<{ shareUrl?: string | string[] }>();
  const shareUrl = Array.isArray(shareUrlParam) ? shareUrlParam[0] : shareUrlParam;
  const { signUp, errors } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const readGlobalError = (): string | null => {
    const g = errors?.global?.[0] as any;
    if (g) return g.longMessage || g.message || null;
    return null;
  };

  const extractFrom = (err: any): string | null =>
    err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || null;

  const finalizeSignUp = async () => {
    const result = await signUp.finalize();
    if (result.error) {
      setError(extractFrom(result.error) || 'Your details are verified, but we could not finish signing you in.');
      return;
    }
    if (shareUrl) {
      router.replace({ pathname: '/save', params: { url: shareUrl, source: 'share_extension' } });
    }
  };

  const finishIfComplete = async () => {
    if (signUp.status === 'complete') {
      await finalizeSignUp();
      return;
    }

    const unmetRequirements = [
      ...signUp.missingFields.map((field) => `missing ${field.replace(/_/g, ' ')}`),
      ...signUp.unverifiedFields.map((field) => `unverified ${field.replace(/_/g, ' ')}`),
    ];
    setError(
      unmetRequirements.length
        ? `Clerk still requires: ${unmetRequirements.join(', ')}. Add those details to your Clerk sign-up settings or contact the app administrator.`
        : `Sign-up stopped at "${signUp.status}". Please try again.`,
    );
  };

  const doSubmitRequirements = async () => {
    if (!signUp || busy) return;
    const needsUsername = signUp.missingFields.includes('username');
    const nextUsername = username.trim();

    if (needsUsername && !nextUsername) {
      setError('Enter a username to continue.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (needsUsername) {
        const update = await signUp.update({ username: nextUsername });
        if (update.error) {
          setError(extractFrom(update.error) || 'Could not save the required username.');
          return;
        }
      }
      await finishIfComplete();
    } catch (e: any) {
      setError(extractFrom(e) || 'Could not save the required sign-up details.');
    } finally {
      setBusy(false);
    }
  };

  const restartSignUp = async () => {
    if (!signUp || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signUp.reset();
      setEmail('');
      setPassword('');
      setCode('');
      setUsername('');
      setVerifying(false);
    } catch (e: any) {
      setError(extractFrom(e) || 'Could not restart sign-up. Please close and reopen this screen.');
    } finally {
      setBusy(false);
    }
  };

  const doSignUp = async () => {
    if (!signUp || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signUp.password({ emailAddress: email.trim(), password });
      if (res.error) {
        setError(extractFrom(res.error) || readGlobalError() || 'Could not create the account.');
        return;
      }
      // Send the verification code the instance requires.
      const send = await signUp.verifications.sendEmailCode();
      if (send.error) {
        setError(extractFrom(send.error) || 'Could not send the verification email.');
        return;
      }
      setVerifying(true);
    } catch (e: any) {
      setError(extractFrom(e) || readGlobalError() || 'Something went wrong. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    if (!signUp || busy) return;
    const verificationCode = code.trim();
    if (!verificationCode) {
      setError('Enter the verification code sent to your email.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await signUp.verifications.verifyEmailCode({ code: verificationCode });
      if (res.error) {
        setError(extractFrom(res.error) || 'That code isn\u2019t valid — check the email and try again.');
        return;
      }
      if (signUp.status === 'complete') {
        await finalizeSignUp();
      } else {
        setVerifying(false);
        await finishIfComplete();
      }
    } catch (e: any) {
      setError(extractFrom(e) || readGlobalError() || 'Verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[type.h1 as any, { color: colors.text, textAlign: 'center' }]}>
          {verifying ? 'Check your email' : signUp?.status === 'missing_requirements' ? 'Complete your account' : 'Create account'}
        </Text>
        <Text style={[type.body as any, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
          {verifying
            ? `Enter the 6-digit code sent to ${email}`
            : signUp?.status === 'missing_requirements'
              ? 'Your email is verified. Add the remaining details required to create your account.'
              : 'A few details and your library is yours.'}
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {verifying ? (
            <>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                accessibilityLabel="Verification code"
                style={styles.input}
              />
              <KIBButton label={busy ? 'Verifying…' : 'Verify'} onPress={doVerify} disabled={busy} />
            </>
          ) : signUp?.status === 'missing_requirements' ? (
            <>
              {signUp.missingFields.includes('username') ? (
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoComplete="username"
                  accessibilityLabel="Username"
                  style={styles.input}
                />
              ) : null}
              {signUp.missingFields.includes('phone_number') ? (
                <Text style={styles.errorText}>
                  This sign-up attempt still requires a phone number. Since phone sign-up is disabled, restart sign-up to refresh the requirements.
                </Text>
              ) : null}
              {signUp.missingFields.some((field) => field !== 'username' && field !== 'phone_number') ? (
                <Text style={styles.errorText}>
                  Clerk also requires: {signUp.missingFields.filter((field) => field !== 'username' && field !== 'phone_number').join(', ')}.
                </Text>
              ) : null}
              {signUp.missingFields.includes('username') ? (
                <KIBButton label={busy ? 'Saving…' : 'Continue'} onPress={doSubmitRequirements} disabled={busy} />
              ) : null}
              {signUp.missingFields.includes('phone_number') ? (
                <KIBButton label={busy ? 'Restarting…' : 'Restart sign-up'} variant="secondary" onPress={restartSignUp} disabled={busy} />
              ) : null}
            </>
          ) : (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel="Email"
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoComplete="password"
                accessibilityLabel="Password"
                style={styles.input}
              />
              <KIBButton label={busy ? 'Creating…' : 'Create account'} onPress={doSignUp} disabled={busy} />
            </>
          )}
          {error ? <Text style={styles.errorText} accessibilityLiveRegion="polite">{error}</Text> : null}
        </View>
      </View>

      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link
          href={shareUrl ? { pathname: '/(auth)/sign-in', params: { shareUrl } } : '/(auth)/sign-in'}
          style={{ color: colors.accentSoft }}
        >
          Sign in
        </Link>
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
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
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center' },
});
