import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, Sheet, TextLink, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useAiConsentAsk } from '@/lib/aiConsent';

// ponytail: "Google doesn't keep it or train on it" is left out until the Gemini API tier in use is confirmed to promise that.
const PROMISES = ['We send only what you give us to read, not your account or contacts.', 'We ask once. Change it any time in Settings.'];

/**
 * "Read it with AI?": the one OK before the first photo, PDF, link or
 * pasted text goes to Google's Gemini (canvas make-bringin-consent). It can
 * open for any of them, so it names none first. Clean text never asks.
 * Mounted once; ensureAiConsent opens it.
 */
export function AiConsentSheet() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ask = useAiConsentAsk((s) => s.ask);
  // iOS can't present a sheet while another (Bring in's) is still going away: a beat first.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(!!ask), ask && Platform.OS === 'ios' ? 450 : 0);
    return () => clearTimeout(t);
  }, [ask]);

  useEffect(() => {
    useAiConsentAsk.setState((s) => ({ hosts: s.hosts + 1 }));
    return () => useAiConsentAsk.setState((s) => ({ hosts: s.hosts - 1 }));
  }, []);

  const answer = (yes: boolean) => {
    useAiConsentAsk.setState({ ask: null });
    ask?.(yes);
  };

  return (
    <Sheet visible={!!ask && shown} onClose={() => answer(false)} accessibilityLabel="Read it with AI?">
      <View style={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.head}>
          <Caption tone="muted" style={styles.eyebrow}>
            BEFORE WE SEND ANYTHING
          </Caption>
          <Title>Read it with AI?</Title>
        </View>
        <Body tone="muted">Photos, PDFs, links and pasted text we can’t read on your phone go to Google’s Gemini to be read. You check every line before anything saves. A clean spec or list you paste is read on your phone and never sent.</Body>
        <View style={[styles.promises, { backgroundColor: ds.c.raised }]}>
          {PROMISES.map((line) => (
            <View key={line} style={styles.promise}>
              <IconSymbol name="checkmark" size={18} color={ds.c.ink} />
              <Body style={styles.flex}>{line}</Body>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          <Button label="Read it" size="lg" onPress={() => answer(true)} />
          <Button label="Not now" size="lg" variant="secondary" onPress={() => answer(false)} />
        </View>
        <View style={styles.center}>
          <TextLink
            label="How we use AI"
            accessibilityHint="Opens the privacy policy"
            onPress={() => {
              answer(false);
              router.push('/legal/privacy');
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.xl - 4, paddingTop: space.lg, gap: space.xl - 4 },
  head: { gap: space.sm },
  eyebrow: { letterSpacing: 0.6 },
  promises: { gap: space.sm + 2, paddingVertical: space.md + 2, paddingHorizontal: space.lg, borderRadius: radius.control + 4 },
  promise: { flexDirection: 'row', gap: space.sm + 2, alignItems: 'flex-start' },
  flex: { flex: 1 },
  buttons: { gap: space.sm },
  center: { alignItems: 'center' },
});
