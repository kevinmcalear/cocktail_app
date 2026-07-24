import { AuthField, AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { useAuth } from '@/ctx/AuthContext';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Button, Input, Text, XStack, YStack, useTheme } from 'tamagui';

export default function Login() {
  const theme = useTheme();
  const { signIn, resendConfirmation } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err.message);
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError('Enter your email to resend confirmation.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await resendConfirmation(email.trim());
    setLoading(false);
    if (err) setError(err.message);
    else setInfo('Confirmation email sent. Check your inbox.');
  };

  const needsConfirm =
    !!error && /confirm|verified|verification/i.test(error);

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your bars, menus, and recipes."
      footer={
        <XStack alignItems="center" gap="$1">
          <Text color="$color11" fontSize={14}>
            No account?
          </Text>
          <Link href="/auth/sign-up" asChild>
            <Pressable>
              <Text color="$color8" fontSize={14} fontWeight="700">
                Create one
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
          placeholder="Your password"
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={handleSignIn}
        />

        <XStack justifyContent="flex-end">
          <Link href="/auth/forgot-password" asChild>
            <Pressable>
              <Text fontSize={13} color="$color8" fontWeight="600">
                Forgot password?
              </Text>
            </Pressable>
          </Link>
        </XStack>

        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {info ? <AuthMessage tone="info">{info}</AuthMessage> : null}

        {needsConfirm ? (
          <Pressable onPress={handleResend} disabled={loading}>
            <Text fontSize={13} color="$color8" fontWeight="600">
              Resend confirmation email
            </Text>
          </Pressable>
        ) : null}

        <Button
          backgroundColor="$color8"
          onPress={handleSignIn}
          disabled={loading}
          borderRadius={8}
          height={44}
          opacity={loading ? 0.7 : 1}
        >
          {loading ? (
            <ActivityIndicator color={theme.backgroundStrong?.get() as string} />
          ) : (
            <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
              Sign in
            </Text>
          )}
        </Button>
      </YStack>
    </AuthShell>
  );
}
