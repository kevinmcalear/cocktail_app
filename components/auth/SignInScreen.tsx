import { AuthLink, AuthMessage, AuthShell, type AuthBrand } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button, Field } from '@/components/ds';
import { useAuth } from '@/ctx/AuthContext';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Email and password sign-in. With a `brand`, it wears the venue's name and
 * logo (the venue staff link, /v/<slug>).
 */
export function SignInScreen({ brand, subtitle }: { brand?: AuthBrand; subtitle?: string } = {}) {
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
      subtitle={subtitle ?? 'Access your bars, menus, and recipes.'}
      brand={brand}
      footer={
        <>
          <AuthLink lead="No account?" label="Create one" href="/auth/sign-up" />
          <AuthLink label="Help and support" href="/support" muted />
        </>
      }
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

      <View style={styles.password}>
        <PasswordField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={handleSignIn}
        />
        <View style={styles.forgot}>
          <AuthLink label="Forgot password?" href="/auth/forgot-password" muted />
        </View>
      </View>

      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
      {info ? <AuthMessage tone="info">{info}</AuthMessage> : null}

      {needsConfirm ? (
        <Button label="Resend confirmation email" variant="secondary" onPress={handleResend} disabled={loading} />
      ) : null}

      <Button label={loading ? 'Signing in…' : 'Sign in'} size="lg" onPress={handleSignIn} disabled={loading} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  password: { gap: 0 },
  forgot: { alignItems: 'flex-end' },
});
