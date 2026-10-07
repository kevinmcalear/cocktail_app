import { AuthLink, AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button, Caption, Field } from '@/components/ds';
import { fontFamilies } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

export default function SignUp() {
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
        footer={<AuthLink label="Back to sign in" href="/auth/login" />}
      >
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button label={loading ? 'Sending…' : 'Resend email'} variant="secondary" size="lg" onPress={handleResend} disabled={loading} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Email and password. That’s it."
      footer={<AuthLink lead="Already have an account?" label="Sign in" href="/auth/login" />}
    >
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@venue.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

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

      <Button label={loading ? 'Creating account…' : 'Create account'} size="lg" onPress={handleSignUp} disabled={loading} />

      <Caption tone="muted" align="center">
        By creating an account you agree to the{' '}
        <Link href="/legal/terms">
          <Caption style={styles.legal}>Terms of use</Caption>
        </Link>{' '}
        and{' '}
        <Link href="/legal/privacy">
          <Caption style={styles.legal}>Privacy policy</Caption>
        </Link>
        .
      </Caption>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  legal: { fontFamily: fontFamilies.bodySemiBold, textDecorationLine: 'underline' },
});
