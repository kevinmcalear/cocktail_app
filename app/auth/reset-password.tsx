import { AuthField, AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/ctx/AuthContext';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Button, Input, Text, YStack, useTheme } from 'tamagui';

export default function ResetPassword() {
  const theme = useTheme();
  const router = useRouter();
  const { session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ponytail: any session on this route can set a password (recovery + refresh); settings covers logged-in change too
  const canReset = !!session;

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

  if (!canReset) {
    return (
      <AuthShell
        title="Link required"
        subtitle="Open the reset link from your email to set a new password."
        footer={
          <Link href="/auth/forgot-password" asChild>
            <Pressable>
              <Text color="$color8" fontSize={14} fontWeight="700">
                Request a new link
              </Text>
            </Pressable>
          </Link>
        }
      >
        <Link href="/auth/login" asChild>
          <Pressable>
            <Text color="$color11" fontSize={14} textAlign="center">
              Back to sign in
            </Text>
          </Pressable>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="This replaces your previous password.">
      <YStack gap="$3">
        <AuthField label="New password">
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            backgroundColor="$background"
            borderColor="$borderColor"
            color="$color"
            height={44}
          />
        </AuthField>

        <AuthField label="Confirm password">
          <Input
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter password"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            backgroundColor="$background"
            borderColor="$borderColor"
            color="$color"
            height={44}
            onSubmitEditing={handleUpdate}
          />
        </AuthField>

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
  );
}
