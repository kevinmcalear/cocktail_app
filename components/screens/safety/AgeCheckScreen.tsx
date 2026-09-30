import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAgeCheck } from '@/hooks/useAgeCheck';

import { AgeCheckForm, UnderAgeNote } from './AgeCheckForm';
import { SafetyPage } from './SafetyPage';

/**
 * Straight after sign-up: the age check, once. It can wait ("Not now"), and
 * then it's asked the first time they collect, rank or publish.
 */
export function AgeCheckScreen() {
  const router = useRouter();
  const { data: status, isError } = useAgeCheck();
  const onward = () => router.replace('/(tabs)');

  // Already answered (a second sign-in link, say): nothing to ask.
  useEffect(() => {
    if (status === 'confirmed') router.replace('/(tabs)');
  }, [status, router]);

  return (
    <SafetyPage title={status === 'under_age' ? 'Welcome' : 'One more thing'} noBack>
      {status === 'under_age' ? (
        <>
          <UnderAgeNote />
          <Caption tone="muted">Everything else in the app, like your venue’s menus and prep, works as usual.</Caption>
          <Button label="Continue" onPress={onward} />
        </>
      ) : status === 'unknown' ? (
        <>
          <AgeCheckForm />
          <View style={styles.later}>
            <Button label="Not now" variant="ghost" accessibilityHint="We'll ask again when you collect, rank or publish a drink" onPress={onward} />
          </View>
        </>
      ) : (
        <Caption tone="muted">{isError ? "Couldn't load your account. Check your connection." : 'One moment…'}</Caption>
      )}
      {isError ? <Button label="Continue" variant="secondary" onPress={onward} /> : null}
    </SafetyPage>
  );
}

const styles = StyleSheet.create({
  later: { alignItems: 'center', marginTop: space.sm },
});
