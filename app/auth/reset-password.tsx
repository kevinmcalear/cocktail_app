import { AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import { EmailLinkGate } from '@/components/auth/EmailLinkGate';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuth } from '@/ctx/AuthContext';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Button, Text, YStack, useTheme } from 'tamagui';

export default function ResetPassword() {
  const theme = useTheme();
  const router = useRouter();
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <EmailLinkGate
      cleanPath="/auth/reset-password"
      ready={!!session}
      retryHref="/auth/forgot-password"
      retryLabel="Request a new link"
      waitingTitle="Reset your password"
      waitingSubtitle="Tap continue, then choose a new password."
    >
      <AuthShell title="Choose a new password" subtitle="This replaces your previous password.">
        <YStack gap="$3">
          <PasswordField
            label="New password"
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
            onSubmitEditing={handleUpdate}
          />

          {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

          <Button
            backgroundColor="$color8"
            onPress={handleUpdate}
            disabled={loading}
            borderRadius={8}
            height={44}
            opacity={loading ? 0.7 : 1}
          >
            {loading ? (
              <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
            ) : (
              <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
                Update password
              </Text>
            )}
          </Button>
        </YStack>
      </AuthShell>
    </EmailLinkGate>
  );
}
