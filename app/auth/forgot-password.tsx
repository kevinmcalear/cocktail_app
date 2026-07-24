import { AuthField, AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/ctx/AuthContext';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Button, Input, Text, YStack, useTheme } from 'tamagui';

export default function ForgotPassword() {
  const theme = useTheme();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter the email for your account.');
      return;
    }
    setLoading(true);
    const { error: err } = await resetPassword(email.trim());
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If an account exists for ${email.trim()}, you’ll get a link to set a new password.`}
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
        <Text fontSize={14} color="$color11" lineHeight={20}>
          The link expires after a short time. Request another if you need it.
        </Text>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="We’ll email you a link to choose a new password."
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
            onSubmitEditing={handleReset}
          />
        </AuthField>

        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

        <Button
          backgroundColor="$color8"
          onPress={handleReset}
          disabled={loading}
          borderRadius={8}
          height={44}
          opacity={loading ? 0.7 : 1}
        >
          {loading ? (
            <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
          ) : (
            <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
              Send reset link
            </Text>
          )}
        </Button>
      </YStack>
    </AuthShell>
  );
}
