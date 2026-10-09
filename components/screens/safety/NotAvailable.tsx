import { useNetInfo } from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';

import { SafetyPage } from './SafetyPage';

const WHY = {
  drink: 'It may have been made private or removed, or a moderator may have hidden it.',
  release: 'The bar may not have published it yet or may have taken it down, or a moderator may have hidden it.',
  menu: 'Whoever made it may have stopped sharing it or made their profile private, or a moderator may have hidden it.',
};

/**
 * Where a link lands when it points at something you can't see: a drink
 * that's private, hidden by a moderator, deleted, or from someone you've
 * blocked, a release that isn't live, or a menu that isn't shared. It
 * doesn't say which, so it gives nothing away about other people's content
 * or blocks.
 */
export function NotAvailable({ what }: { what: keyof typeof WHY }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const blocked = signedIn && what !== 'release' ? ' Or it’s from someone you’ve blocked.' : '';
  return (
    <SafetyPage title="Not available" intro={`This ${what} isn’t available to you. ${WHY[what]}${blocked}`} backTo="/">
      <View style={styles.actions}>
        {signedIn ? (
          <Button label="Discover drinks" onPress={() => router.replace('/discover')} />
        ) : (
          <Button label="Sign in to find more" onPress={() => router.replace('/auth/login')} />
        )}
      </View>
    </SafetyPage>
  );
}

/** A retry of the requests that failed. Retrying puts the page back to loading (TanStack resets an errored query with no data to pending). */
export interface LoadFailure {
  retry: () => void;
}

/**
 * Where a public page lands when its request failed: offline, a timeout, a
 * server error. Says so and offers a retry, rather than Not available, which
 * would wrongly suggest the owner or a moderator hid it.
 */
export function CouldNotLoad({ what, failed }: { what: keyof typeof WHY; failed: LoadFailure }) {
  const offline = useNetInfo().isConnected === false;
  const intro = offline ? 'You’re offline. Check your connection and try again.' : 'Something went wrong on our side. Try again in a moment.';
  return (
    <SafetyPage title={`Couldn’t load this ${what}`} intro={intro} backTo="/">
      <View style={styles.actions}>
        <Button label="Try again" onPress={failed.retry} />
      </View>
    </SafetyPage>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
});
