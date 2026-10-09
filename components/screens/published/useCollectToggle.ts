import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useSignedIn } from '@/ctx/AuthContext';
import { useCollect, useCollection } from '@/hooks/useCollection';

import { useAgeGate } from '../safety/AgeGate';

export type CollectTarget = { kind: 'drink'; itemId: string; releaseId?: string | null } | { kind: 'release'; releaseId: string };

/**
 * Collect a drink or a release, or let it go: the Collect button on a bar's
 * drink, and the To make bookmark on every drink page. Signed out, it asks
 * you to sign in; without a confirmed age, it asks for that first and then
 * collects (the database refuses the save otherwise). Render `sheet`.
 */
export function useCollectToggle(target: CollectTarget, name: string) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const { data: collection } = useCollection();
  const age = useAgeGate();
  const collect = useCollect();
  const [error, setError] = useState<string | null>(null);

  const mine =
    target.kind === 'drink'
      ? collection?.drinks.find((d) => d.itemId === target.itemId)
      : collection?.releases.find((r) => r.releaseId === target.releaseId);

  const toggle = () => {
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
    if (age.underAge) return setError('Saving drinks needs you to be of drinking age where you live.');
    age.gate(() =>
      collect.mutateAsync(target).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Couldn’t save that. Try again.'))
    );
  };

  return { saved: !!mine, toggle, error, pending: collect.isPending, sheet: age.sheet };
}
