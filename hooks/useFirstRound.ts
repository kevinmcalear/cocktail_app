import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { create } from 'zustand';

import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useMode } from '@/hooks/useMode';
import { markDone, readRound, roundKind, roundView, seeDone, seeOpened, skipAll, startRound, type FirstRound, type RoundTab, type StepKey } from '@/lib/firstRound';
import { supabase } from '@/lib/supabase';

/**
 * The round as just changed here, ahead of the user_metadata round trip, so a
 * tab opens the moment its step does. Per person, so a sign-out can't carry it over.
 * ponytail: a change made offline is kept only until the app closes; the round
 * is a nudge, and Settings replays it. Upgrade path: persist this store.
 */
const usePending = create<{ userId: string | null; round: FirstRound | null; set: (userId: string, round: FirstRound) => void }>((set) => ({
  userId: null,
  round: null,
  set: (userId, round) => set({ userId, round }),
}));

async function save(round: FirstRound) {
  // Merged into user_metadata beside `onboarded`; AuthContext picks up USER_UPDATED.
  const { error } = await supabase.auth.updateUser({ data: { first_round: round } });
  if (error && __DEV__) console.warn('first round not saved', error.message);
}

/** Starts a round: when setup finishes, and from Settings' Replay. */
export async function saveNewRound() {
  await save(startRound(new Date().toISOString()));
}

/**
 * The first round where you are (lib/firstRound.ts): which steps are done,
 * which tabs it still holds back, and the actions. Only at a venue; at home,
 * and for anyone without a round, it's inactive and holds nothing back.
 */
export function useFirstRound() {
  const { user } = useAuth();
  const { mode } = useMode();
  const { active } = useActiveVenue();
  const pending = usePending();
  const userId = user?.id ?? null;
  const stored = readRound(user?.user_metadata);
  const round = pending.userId === userId && pending.round ? pending.round : stored;
  const venue = mode === 'venue' ? active : null;
  const kind = roundKind(venue?.roleLevel ?? 0);
  const view = roundView(venue ? round : null, kind);

  const setPending = pending.set;
  const write = useCallback(
    (change: (r: FirstRound) => FirstRound) => {
      const now = usePending.getState();
      const base = now.userId === userId && now.round ? now.round : readRound(user?.user_metadata);
      if (!base || !userId) return;
      const next = change(base);
      if (next === base) return;
      setPending(userId, next);
      void save(next);
    },
    [user?.user_metadata, userId, setPending]
  );

  return {
    ...view,
    kind,
    venue,
    done: useCallback((key: StepKey) => write((r) => markDone(r, key)), [write]),
    showEverything: useCallback(() => write((r) => skipAll(r, new Date().toISOString())), [write]),
    seeOpened: useCallback((tab: RoundTab) => write((r) => seeOpened(r, tab)), [write]),
    seeDone: useCallback(() => write(seeDone), [write]),
    replay: useCallback(() => {
      if (!userId) return;
      const next = startRound(new Date().toISOString());
      setPending(userId, next);
      void save(next);
    }, [userId, setPending]),
  };
}

/** Marks a step done when its tab is opened (Discover; Menus for staff), while it's the step that's up. */
export function useRoundVisit(tab: RoundTab) {
  const { active, current, done } = useFirstRound();
  const key = active && current?.opens === tab ? current.key : null;
  // Opening Menus does a staff member's step; a maker's Menus step is putting a drink on one.
  const counts = key === 'open_menu' || key === 'discover';
  useFocusEffect(
    useCallback(() => {
      if (key && counts) done(key);
    }, [key, counts, done])
  );
}
