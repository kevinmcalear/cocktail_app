import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { CLAIM_RETURN_KEY, claimRecord, readClaimReturn } from './claimLink';
import { deviceStore } from './deviceStore';

/** Remember a claim opened while signed out, to open again after signing in. */
export async function saveClaimReturn(ref: string): Promise<void> {
  try {
    await deviceStore.setItem(CLAIM_RETURN_KEY, claimRecord(ref, Date.now()));
  } catch {
    // No storage (a private window): they open the link again after signing in.
  }
}

// One reader at a time, so two effects (or Strict Mode's second run) can't both get it.
let taking = false;

/** The claim to open after signing in, once: reading it forgets it. */
async function takeClaimReturn(): Promise<string | null> {
  if (taking) return null;
  taking = true;
  try {
    const path = readClaimReturn(await deviceStore.getItem(CLAIM_RETURN_KEY), Date.now());
    if (path) await deviceStore.removeItem(CLAIM_RETURN_KEY);
    return path;
  } catch {
    return null;
  } finally {
    taking = false;
  }
}

/**
 * Once `ready`, open the claim remembered from "Claim it on your phone"
 * (find-yourself step 4): the tabs once someone signed in is past Setup, and
 * Setup's find step for a new account.
 */
export function useClaimReturn(ready: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    void takeClaimReturn().then((path) => {
      if (path) router.push(path as Href);
    });
  }, [ready, router]);
}
