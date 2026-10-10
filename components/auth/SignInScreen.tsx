import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AuthLink, AuthMessage, AuthShell, type AuthBrand } from '@/components/auth/AuthShell';
import { CodeField } from '@/components/auth/CodeField';
import { Button, Caption, Field, TextLink } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { CODE_LENGTH, RESEND_AFTER, emailLooksRight, sendProblem, verifyProblem } from '@/lib/authCode';

/**
 * Sign in, or sign up, with a code from an email: no password. Step one asks
 * for the email; step two takes the code (the email's link also works on the
 * device it's opened on). With a `brand`, it wears the venue's name and logo
 * (the venue staff link, /v/<slug>).
 */
export function SignInScreen({ brand, subtitle }: { brand?: AuthBrand; subtitle?: string } = {}) {
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wrongCode, setWrongCode] = useState(false);
  const [wait, setWait] = useState(0);

  // Counts down to when another code can be sent.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = async (to: string) => {
    setError(null);
    if (!emailLooksRight(to)) {
      setError('Enter the email you want to sign in with.');
      return;
    }
    setBusy(true);
    const { error: problem } = await sendCode(to);
    setBusy(false);
    if (problem) {
      setError(sendProblem(problem));
      return;
    }
    setSentTo(to);
    setCode('');
    setWrongCode(false);
    setWait(RESEND_AFTER);
  };

  const check = async (typed: string) => {
    if (!sentTo || typed.length < CODE_LENGTH) return;
    setError(null);
    setBusy(true);
    const { error: problem } = await verifyCode(sentTo, typed);
    setBusy(false);
    // Signed in: the root layout takes it from here.
    if (!problem) return;
    setError(verifyProblem(problem));
    setWrongCode(true);
  };

  const onCode = (typed: string) => {
    setCode(typed);
    setWrongCode(false);
    if (typed.length === CODE_LENGTH) void check(typed);
  };

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a code to ${sentTo}. Type it here, or tap the button in the email on this device.`}
        brand={brand}
        footer={<AuthLink label="Help and support" href="/support" muted />}
      >
        <CodeField value={code} onChangeText={onCode} invalid={wrongCode} disabled={busy} />
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button
          label={busy ? 'Checking…' : 'Sign in'}
          size="lg"
          onPress={() => void check(code)}
          disabled={busy || code.length < CODE_LENGTH}
        />
        {Platform.OS === 'ios' ? (
          <Button label="Open Mail" variant="secondary" onPress={() => void Linking.openURL('message://').catch(() => {})} />
        ) : null}
        <View style={styles.after}>
          <Caption tone="muted">
            {wait > 0 ? `Nothing yet? Check spam. You can ask for a new code in ${wait}s.` : 'Nothing yet? Check spam, or send a new code.'}
          </Caption>
          <View style={styles.links}>
            {wait > 0 ? null : <TextLink label="Send a new code" onPress={() => void send(sentTo)} />}
            <TextLink
              label="Use a different email"
              onPress={() => {
                setSentTo(null);
                setError(null);
              }}
            />
          </View>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle={subtitle ?? 'Every spec with its amounts, your bars, menus and rankings.'}
      brand={brand}
      footer={<AuthLink label="Help and support" href="/support" muted />}
    >
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => void send(email.trim())}
      />
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
      <Button label={busy ? 'Sending…' : 'Email me a code'} size="lg" onPress={() => void send(email.trim())} disabled={busy} />
      <Caption tone="muted">No password. New here or coming back, it’s the same: we email you a {CODE_LENGTH}-digit code.</Caption>
      <Caption tone="muted">
        By continuing you agree to the{' '}
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
  after: { gap: space.xs },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  legal: { fontFamily: fontFamilies.bodySemiBold, textDecorationLine: 'underline' },
});
