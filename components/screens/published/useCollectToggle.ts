import { useRouter } from 'expo-router';
import { useState } from 'react';

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
export function useCollectToggle(target: CollectTarget, live = true) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const { data: collection } = useCollection(live);
  const age = useAgeGate();
  const collect = useCollect();
  const [error, setError] = useState<string | null>(null);

  const mine =
    target.kind === 'drink'
      ? collection?.drinks.find((d) => d.itemId === target.itemId)
      : collection?.releases.find((r) => r.releaseId === target.releaseId);

  const toggle = () => {
    setError(null);
    if (!signedIn) return router.push('/auth/login?step=email');
    // Letting go of a drink keeps your day and note (a had): saving it again brings them back.
    if (mine) return collect.mutate({ kind: target.kind === 'drink' ? 'remove-drink' : 'remove-release', id: mine.id });
    if (age.underAge) return setError('Saving drinks needs you to be of drinking age where you live.');
    age.gate(() =>
      collect.mutateAsync(target).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Couldn’t save that. Try again.'))
    );
  };

  return { saved: !!mine, toggle, error, pending: collect.isPending, sheet: age.sheet };
}
