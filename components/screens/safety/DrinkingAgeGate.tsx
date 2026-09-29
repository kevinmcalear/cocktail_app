import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Button, Title, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useIsHydrated } from '@/hooks/useIsHydrated';
import { deviceStore } from '@/lib/deviceStore';

const KEY = 'drinking-age-answer';
type Answer = 'yes' | 'no';

/**
 * Wraps the public drink and release pages (/d, /r). Signed-out web visitors are asked once
 * whether they're of drinking age where they live; the answer stays on this
 * device and nowhere else. Signed-in people passed the real age check, and
 * native apps always have an account, so they go straight through.
 */
export function DrinkingAgeGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const asks = Platform.OS === 'web' && !loading && !user;
  const hydrated = useIsHydrated();
  const [answer, setAnswer] = useState<Answer | null | undefined>(undefined);

  useEffect(() => {
    if (!asks) return;
    deviceStore
      .getItem(KEY)
      .then((v) => setAnswer(v === 'yes' || v === 'no' ? v : null))
      .catch(() => setAnswer(null));
  }, [asks]);

  if (!asks || answer === 'yes') return <>{children}</>;
  const reply = (a: Answer) => {
    setAnswer(a);
    void deviceStore.setItem(KEY, a).catch(() => {});
  };
  return (
    <BackbarTheme>
      <Question answer={hydrated ? answer : undefined} onAnswer={reply} />
    </BackbarTheme>
  );
}

function Question({ answer, onAnswer }: { answer: Answer | null | undefined; onAnswer: (a: Answer) => void }) {
  const ds = useDs();
  const gutter = useGutter();
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, padding: gutter }]}>
      {answer === undefined ? null : (
        <View style={styles.box} role={answer === 'no' ? 'status' : 'dialog'} aria-label="Drinking age">
          {answer === 'no' ? (
            <>
              <Title align="center">Come back another time</Title>
              <Body align="center" tone="muted">
                These pages are about alcohol, so they’re only for people of drinking age where they live.
              </Body>
            </>
          ) : (
            <>
              <Title align="center">Are you of drinking age where you live?</Title>
              <Body align="center" tone="muted">
                This page is about alcohol. We only remember your answer on this device.
              </Body>
              <View style={styles.actions}>
                <Button label="Yes, I am" onPress={() => onAnswer('yes')} />
                <Button label="No" variant="secondary" onPress={() => onAnswer('no')} />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  box: { width: '100%', maxWidth: 440, gap: space.md, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});
