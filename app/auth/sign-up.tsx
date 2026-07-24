import { AuthField, AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuth } from '@/ctx/AuthContext';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Button, Input, Text, XStack, YStack, useTheme } from 'tamagui';

export default function SignUp() {
  const theme = useTheme();
  const { signUp, resendConfirmation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerify, setPendingVerify] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { session, error: err } = await signUp(trimmed, password);
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }
    if (!session) setPendingVerify(true);
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    const { error: err } = await resendConfirmation(email.trim());
    setLoading(false);
    if (err) setError(err.message);
  };

  if (pendingVerify) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email.trim()}. Open it to activate your account.`}
        footer={
          <Link href="/auth/login" asChild>
            <Pressable>
              <Text color="$color8" fontSize={14} fontWeight="700">
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        }
      >
        <YStack gap="$3">
          {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
          <Button
            backgroundColor="$color8"
            onPress={handleResend}
            disabled={loading}
            borderRadius={8}
            height={44}
            opacity={loading ? 0.7 : 1}
          >
            {loading ? (
              <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
            ) : (
              <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
                Resend email
              </Text>
            )}
          </Button>
        </YStack>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Email and password. That’s it."
      footer={
        <XStack alignItems="center" gap="$1">
          <Text color="$color11" fontSize={14}>
            Already have an account?
          </Text>
          <Link href="/auth/login" asChild>
            <Pressable>
              <Text color="$color8" fontSize={14} fontWeight="700">
                Sign in
              </Text>
            </Pressable>
          </Link>
        </XStack>
      }
    >
      <YStack gap="$3">
        <AuthField label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@venue.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            backgroundColor="$background"
            borderColor="$borderColor"
            color="$color"
            height={44}
          />
        </AuthField>

        <PasswordField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <PasswordField
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Re-enter password"
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={handleSignUp}
        />

        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

        <Button
          backgroundColor="$color8"
          onPress={handleSignUp}
          disabled={loading}
          borderRadius={8}
          height={44}
          opacity={loading ? 0.7 : 1}
        >
          {loading ? (
            <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
          ) : (
            <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
              Create account
            </Text>
          )}
        </Button>
      </YStack>
    </AuthShell>
  );
}
