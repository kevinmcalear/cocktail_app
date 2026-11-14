import { useMutationState, type Mutation, type MutationKey } from '@tanstack/react-query';

import { BAR_WRITE } from '@/lib/offlineWrites';
import { isKeptWrite } from '@/lib/keptWrites';

export interface UnsentWrite<V = unknown> {
  /** What it sends. */
  variables: V;
  /** When it was made. */
  at: number;
  /** Refused (or out of tries) after waiting: why, as the error had it. Null while it waits for signal. */
  failed: string | null;
  /** The write itself, for Send and Discard (lib/unsentActions.ts). */
  write: Mutation<unknown, Error, unknown, unknown>;
}

/** Why a write didn't send, from its error (one restored after a relaunch may have lost its words). */
function why(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.trim() ? message.trim() : 'It didn’t send.';
}

/**
 * Writes saved on this phone and not in yet (lib/offlineWrites.ts), oldest
 * first: waiting for signal, or refused after waiting and kept so nothing is
 * lost. Every behind-the-bar write by default, or one kind (MENU_LAYOUT).
 * components/UnsentWrites.tsx shows them (Sta-errors: Didn't send, Waiting to send).
 */
export function useUnsentWrites<V = unknown>(mutationKey: MutationKey = [BAR_WRITE]): UnsentWrite<V>[] {
  return useMutationState({
    filters: { mutationKey, predicate: (m) => isKeptWrite(m as Mutation<unknown, Error, unknown, unknown>) },
    select: (m) => ({
      variables: m.state.variables as V,
      at: m.state.submittedAt,
      failed: m.state.status === 'error' ? why(m.state.error) : null,
      write: m as Mutation<unknown, Error, unknown, unknown>,
    }),
  });
}
