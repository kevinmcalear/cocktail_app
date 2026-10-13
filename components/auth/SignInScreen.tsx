import { Link, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AuthLink, AuthMessage, AuthShell, type AuthBrand } from '@/components/auth/AuthShell';
import { CodeField } from '@/components/auth/CodeField';
import { Body, Button, Caption, Field, TextLink, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { CODE_LENGTH, LIMIT_WAIT, RESEND_AFTER, emailLooksRight, formatWait, sendProblem, verifyProblem } from '@/lib/authCode';
import { deviceStore } from '@/lib/deviceStore';

/** The address a code was last sent to on this device, until it signs in: an expired link offers it again. */
const LAST_EMAIL = 'auth.lastEmail';

/** Mail apps the code step can open. Mail on iPhones and Macs; Gmail everywhere (its web inbox when the app isn't there). */
const onMac = Platform.OS === 'web' && typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
const openMail = () => void Linking.openURL('message://').catch(() => {});
const openGmail = () =>
  void (Platform.OS === 'ios' ? Linking.openURL('googlegmail://') : Promise.reject()).catch(() => Linking.openURL('https://mail.google.com/').catch(() => {}));

/**
 * Sign in, or sign up, with a code from an email: no password. Step one asks
 * for the email; step two takes the code (the email's link also works on the
 * device it's opened on). With a `brand`, it wears the venue's name and logo
 * (the venue staff link, /v/<slug>). `expired` is the page an old sign-in
 * link lands on: the email again (remembered on this device) and a new code.
 */
export function SignInScreen({ brand, subtitle, expired }: { brand?: AuthBrand; subtitle?: string; expired?: boolean } = {}) {
  const ds = useDs();
  const router = useRouter();
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

  useEffect(() => {
    if (!expired) return;
    void deviceStore.getItem(LAST_EMAIL).then((last) => last && setEmail((typed) => typed || last), () => {});
  }, [expired]);

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
      if (problem.code === 'over_request_rate_limit') setWait(LIMIT_WAIT);
      return;
    }
    void deviceStore.setItem(LAST_EMAIL, to).catch(() => {});
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
    if (!problem) {
      void deviceStore.removeItem(LAST_EMAIL).catch(() => {});
      return;
    }
    setError(verifyProblem(problem));
    setWrongCode(true);
    // After a few wrong tries the button counts down instead of sending.
    if (problem.code === 'over_request_rate_limit') setWait(LIMIT_WAIT);
  };

  const onCode = (typed: string) => {
    setCode(typed);
    setWrongCode(false);
    setError(null);
    if (typed.length === CODE_LENGTH) void check(typed);
  };

  if (sentTo) {
    const changeEmail = () => {
      setSentTo(null);
      setError(null);
    };
    return (
      <AuthShell
        title="Check your email"
        titleSize="title"
        subtitle={
          <>
            {'We sent a code to '}
            <Body color={ds.c.ink}>{sentTo}</Body>
            {wrongCode ? '.' : '. Type it here, or tap the button in the email on this device.'}
          </>
        }
        brand={brand}
        onBack={changeEmail}
      >
        <CodeField value={code} onChangeText={onCode} invalid={wrongCode} disabled={busy} />
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {busy ? <Caption tone="muted">Checking…</Caption> : null}
        {wrongCode ? (
          <Button
            label={wait > 0 ? `Send a new code in ${formatWait(wait)}` : 'Send a new code'}
            size="lg"
            disabled={wait > 0 || busy}
            onPress={() => void send(sentTo)}
          />
        ) : (
          <>
            <View style={styles.apps}>
              {Platform.OS === 'ios' || onMac ? <Button label="Open Mail" variant="secondary" onPress={openMail} style={styles.app} /> : null}
              <Button label="Open Gmail" variant="secondary" onPress={openGmail} style={styles.app} />
            </View>
            <View style={styles.resend}>
              {wait > 0 ? (
                <Body tone="muted">
                  {'Nothing yet? Check spam, or '}
                  <Body color={ds.c.ink}>{`send a new code in ${formatWait(wait)}`}</Body>.
                </Body>
              ) : (
                <>
                  <Body tone="muted">Nothing yet? Check spam, or</Body>
                  <TextLink label="send a new code" tone="ink" onPress={() => void send(sentTo)} />
                </>
              )}
            </View>
          </>
        )}
        <View style={styles.links}>
          <TextLink label="Use a different email" onPress={changeEmail} />
        </View>
      </AuthShell>
    );
  }

  const field = (
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
  );

  if (expired) {
    return (
      <AuthShell
        title="That link has run out"
        titleSize="title"
        subtitle="Sign-in links and codes work once, for 10 minutes. This one is used or too old. We’ll send a fresh one."
        onBack={() => router.replace('/auth/login')}
      >
        {field}
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        <Button label={busy ? 'Sending…' : 'Email me a new code'} size="lg" onPress={() => void send(email.trim())} disabled={busy || wait > 0} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle={subtitle ?? 'Every spec with its amounts, your bars, menus and rankings.'}
      brand={brand}
      footer={
        <>
          <Caption tone="muted" align="center">
            {'By continuing you agree to the '}
            <Link href="/legal/terms">
              <Caption style={styles.legal}>Terms</Caption>
            </Link>
            {' and '}
            <Link href="/legal/privacy">
              <Caption style={styles.legal}>Privacy policy</Caption>
            </Link>
            .
          </Caption>
          <AuthLink label="Help and support" href="/support" muted />
        </>
      }
    >
      {field}
      {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
      <Button label={busy ? 'Sending…' : 'Email me a code'} size="lg" onPress={() => void send(email.trim())} disabled={busy || wait > 0} />
      <Caption tone="muted">No password. New here or coming back, it’s the same: we email you a six-digit code.</Caption>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  apps: { flexDirection: 'row', gap: space.sm },
  app: { flex: 1 },
  resend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.xs },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  legal: { fontFamily: fontFamilies.bodyMedium, textDecorationLine: 'underline' },
});
