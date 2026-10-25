import { CLAIM_RETURN_KEY, claimRecord, readClaimReturn } from './claimLink';
import { deviceStore } from './deviceStore';

/** Remember a claim opened while signed out, to open again after signing in. */
export async function saveClaimReturn(handle: string): Promise<void> {
  try {
    await deviceStore.setItem(CLAIM_RETURN_KEY, claimRecord(handle, Date.now()));
  } catch {
    // No storage (a private window): they open the link again after signing in.
  }
}

/** The claim to open after signing in, once: reading it forgets it. */
export async function takeClaimReturn(): Promise<string | null> {
  try {
    const path = readClaimReturn(await deviceStore.getItem(CLAIM_RETURN_KEY), Date.now());
    if (path) await deviceStore.removeItem(CLAIM_RETURN_KEY);
    return path;
  } catch {
    return null;
  }
}
