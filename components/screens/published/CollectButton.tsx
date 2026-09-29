import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useAgeCheck, useCollect, useCollection } from '@/hooks/useCollection';

type Target = { kind: 'drink'; itemId: string; releaseId?: string | null } | { kind: 'release'; releaseId: string };

/**
 * Collect a published drink or a live release. Signed out, it asks you to
 * sign in; without a confirmed age, it goes to the age check first (the
 * database refuses the save otherwise). Collected, it lets go again.
 */
export function CollectButton({ target, name }: { target: Target; name: string }) {
  const router = useRouter();
  const signedIn = !!useAuth().user;
  const { data: collection } = useCollection();
  const { data: age } = useAgeCheck();
  const collect = useCollect();
  const [error, setError] = useState<string | null>(null);

  const mine =
    target.kind === 'drink'
      ? collection?.drinks.find((d) => d.itemId === target.itemId)
      : collection?.releases.find((r) => r.releaseId === target.releaseId);

  const press = async () => {
    setError(null);
    if (!signedIn) return router.push('/auth/login');
    if (mine) {
      const remove = () => collect.mutate({ kind: target.kind === 'drink' ? 'remove-drink' : 'remove-release', id: mine.id });
      // Letting go deletes the memory: ask first when you wrote something on it.
      if ('note' in mine && (mine.note || mine.hadOn)) {
        return Alert.alert(`Remove ${name}?`, 'Your date and note go with it.', [
          { text: 'Keep it', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: remove },
        ]);
      }
      return remove();
    }
    if (age === 'under_age') return setError('Collecting drinks needs you to be of drinking age where you live.');
    if (age !== 'confirmed') return router.push('/age-check');
    try {
      await collect.mutateAsync(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t collect that. Try again.');
    }
  };

  return (
    <View style={styles.wrap}>
      <Button
        label={mine ? 'Collected' : 'Collect'}
        icon={mine ? 'bookmark.fill' : 'bookmark'}
        variant={mine ? 'secondary' : 'primary'}
        disabled={collect.isPending}
        accessibilityHint={mine ? `Removes ${name} from your collection` : `Keeps ${name} in your collection`}
        onPress={press}
      />
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: 'flex-start' },
});
