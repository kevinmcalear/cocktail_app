import type { AsyncStorage, PersistedClient, PersistedQuery } from '@tanstack/query-persist-client-core';

import { ROW_KEY, SET_ASIDE_KEY, SET_ASIDE_WRITE } from '@/lib/queryCachePersist';

/**
 * The saved row's writes, checked as the app opens (lib/react-query.ts restoreRow): loaded only when the row has
 * writes in it, or couldn't be read, so most launches don't load it. Nothing here may stop the app opening.
 */
type Saved = { mutationKey?: unknown; state?: { status?: unknown; isPaused?: unknown; variables?: unknown; submittedAt?: unknown; owner?: unknown } };
const STATUSES = ['idle', 'pending', 'error', 'success'];
const UNREAD = 'It couldn’t be read back after the app closed. Send it again, or discard it.';

/**
 * A saved row's writes, checked before they're restored: one whole is kept; one this app can still send but whose
 * state is broken comes back as didn't send (its variables kept, listed on Tonight); anything else is set aside.
 * Broken queries just go (they're fetched again). `canSend` says a key has a registered mutationFn.
 */
export function checkSavedWrites(row: PersistedClient, canSend: (key: readonly unknown[]) => boolean): { row: PersistedClient; setAside: unknown[] } {
  const setAside: unknown[] = [];
  const mutations: unknown[] = [];
  const saved: unknown = row.clientState?.mutations;
  for (const m of (Array.isArray(saved) ? saved : []) as (Saved | null)[]) {
    const key = m?.mutationKey;
    const sendable = Array.isArray(key) && canSend(key);
    const state = m?.state && typeof m.state === 'object' ? m.state : undefined;
    if (sendable && state && STATUSES.includes(state.status as string) && typeof state.isPaused === 'boolean') mutations.push(m);
    else if (sendable && state && state.variables !== undefined)
      mutations.push({
        ...m,
        state: {
          context: undefined,
          data: undefined,
          error: { message: UNREAD },
          failureCount: 0,
          failureReason: null,
          isPaused: false,
          status: 'error',
          variables: state.variables,
          submittedAt: Number(state.submittedAt) || Date.now(),
          ...(state.owner !== undefined ? { owner: state.owner } : {}),
        },
      });
    else setAside.push(m);
  }
  const queries: unknown = row.clientState?.queries;
  const whole = (Array.isArray(queries) ? queries : []).filter(
    (q: Partial<PersistedQuery> | null) => !!q && Array.isArray(q.queryKey) && typeof q.queryHash === 'string' && !!q.state && typeof q.state === 'object',
  );
  return { row: { ...row, clientState: { mutations, queries: whole } as PersistedClient['clientState'] }, setAside };
}

const SET_ASIDE_WHY = 'This phone couldn’t read them back after the app closed, so they can’t be sent. Make them again, then discard this.';
type Batch = { at: number; items: unknown };

/** Every batch set aside so far: each is kept until it's discarded or the person signs out (lib/clearUserData.ts). */
async function readBatches(storage: AsyncStorage<string>): Promise<Batch[]> {
  const raw = await Promise.resolve(storage.getItem(SET_ASIDE_KEY)).catch(() => null);
  if (!raw) return [];
  try {
    const kept: unknown = JSON.parse(raw);
    // One from the first build of this kept a single batch.
    return Array.isArray(kept) ? (kept as Batch[]) : [kept as Batch];
  } catch {
    return [{ at: 0, items: raw }];
  }
}

/** Drops one batch, discarded from "Waiting to send". */
export async function dropSetAside(storage: AsyncStorage<string>, at: number): Promise<void> {
  const left = (await readBatches(storage)).filter((b) => b.at !== at);
  await Promise.resolve(left.length ? storage.setItem(SET_ASIDE_KEY, JSON.stringify(left)) : storage.removeItem(SET_ASIDE_KEY)).catch(() => undefined);
}

/** The row for a batch: refused, stamped with whoever made the writes in it when that's one person. */
function setAsideRow(at: number, items: unknown) {
  const owners = new Set((Array.isArray(items) ? items : []).map((m: Saved | null) => m?.state?.owner).filter((o) => o !== undefined));
  const count = Array.isArray(items) ? items.length : 0;
  return {
    mutationKey: [...SET_ASIDE_WRITE],
    state: {
      context: undefined,
      data: undefined,
      error: { message: SET_ASIDE_WHY },
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      status: 'error',
      variables: { at, count },
      submittedAt: at,
      ...(owners.size === 1 ? { owner: [...owners][0] } : {}),
    },
  };
}

/**
 * A row read back with writes in it: whole ones kept, broken ones sorted (checkSavedWrites), and what can't be
 * sent set aside, added to the batches before it and listed in "Waiting to send" as didn't send.
 */
export async function checkRow(
  row: PersistedClient,
  storage: AsyncStorage<string>,
  canSend: (key: readonly unknown[]) => boolean,
  report: (e: unknown, about: Record<string, unknown>) => void,
): Promise<PersistedClient> {
  const checked = checkSavedWrites(row, canSend);
  if (checked.setAside.length) {
    checked.row.clientState.mutations.push((await setAside(storage, checked.setAside)) as unknown as PersistedClient['clientState']['mutations'][number]);
    report(new Error('Saved writes set aside: unreadable'), { count: checked.setAside.length });
  }
  return checked.row;
}

/**
 * A row that couldn't be read at all (corrupt, or too big to read): set aside as it was, reported, and the app
 * opens with nothing from it but the line saying so. ponytail: one too big to read can't be read to set aside either.
 */
export async function setAsideUnreadable(
  e: unknown,
  storage: AsyncStorage<string>,
  report: (e: unknown, about: Record<string, unknown>) => void,
  buster: string,
): Promise<PersistedClient | undefined> {
  const raw = await Promise.resolve(storage.getItem(ROW_KEY)).catch(() => null);
  await Promise.resolve(storage.removeItem(ROW_KEY)).catch(() => undefined);
  report(e, { where: 'restore', setAside: !!raw });
  if (!raw) return undefined;
  const mutations = [await setAside(storage, raw)] as unknown as PersistedClient['clientState']['mutations'];
  return { timestamp: Date.now(), buster, clientState: { mutations, queries: [] } };
}

/** Adds a batch to the ones set aside before it, and gives the row that lists it. */
async function setAside(storage: AsyncStorage<string>, items: unknown) {
  const at = Date.now();
  const batches = [...(await readBatches(storage)), { at, items }];
  await Promise.resolve(storage.setItem(SET_ASIDE_KEY, JSON.stringify(batches))).catch(() => undefined);
  return setAsideRow(at, items);
}
