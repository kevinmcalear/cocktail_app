import { AuthLink, AuthMessage, AuthShell } from '@/components/auth/AuthShell';
import { Body, Button, Field } from '@/components/ds';
import { useAuth } from '@/ctx/AuthContext';
import { useState } from 'react';

export default function ForgotPassword() {
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
        footer={<AuthLink label="Back to sign in" href="/auth/login" />}
      >
        <Body tone="muted">The link expires after a short time. Request another if you need it.</Body>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="We’ll email you a link to choose a new password."
      footer={<AuthLink label="Back to sign in" href="/auth/login" />}
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
        onSubmitEditing={handleReset}
      />

      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

      <Button label={loading ? 'Sending…' : 'Send reset link'} size="lg" onPress={handleReset} disabled={loading} />
    </AuthShell>
  );
}
