import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { isSpecView, pickSpecView, type SpecView } from '@/lib/specView';
import { supabase } from '@/lib/supabase';

// The spec's Ingredients | Steps pick (decision spec-toggle: sticky), on the
// account so it follows the person to every device (user_prefs.spec_view,
// 20261205810000). Signed out, it stays on this phone. Before the account
// kept it, each phone kept every person's pick under 'spec-view' (a zustand
// store, by user id, '' signed out); the first read signed in brings that
// pick across.

const DEVICE_KEY = 'spec-view';
const myKey = (userId: string | null) => ['my-spec-view', userId ?? 'device'] as const;

async function devicePick(person: string): Promise<SpecView | null> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(DEVICE_KEY)) ?? '{}') as { state?: { views?: Record<string, unknown> } };
    const pick = saved.state?.views?.[person];
    return isSpecView(pick) ? pick : null;
  } catch {
    return null;
  }
}

async function keepOnDevice(person: string, view: SpecView) {
  const saved = JSON.parse((await AsyncStorage.getItem(DEVICE_KEY)) ?? '{}') as { state?: { views?: Record<string, SpecView> } };
  await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify({ state: { views: { ...saved.state?.views, [person]: view } } }));
}

/**
 * The view this person reads specs in, and a setter that remembers it. Until
 * they pick, `maker` decides: Steps for people who make the drink, Ingredients
 * for everyone else.
 */
export function useSpecView(maker: boolean): [SpecView, (view: SpecView) => void] {
  const userId = useUserId();
  const client = useQueryClient();
  const key = myKey(userId);
  const { data } = useQuery({
    queryKey: key,
    staleTime: 60_000,
    // Saved with the drink pages, so a spec opens in their view with no signal.
    meta: { persist: true },
    queryFn: async (): Promise<SpecView | null> => {
      // Signed in, this phone's pick for them, else the one made here signed out.
      const local = (userId ? await devicePick(userId) : null) ?? (await devicePick(''));
      if (!userId) return local;
      const { data: row, error } = await supabase.from('user_prefs').select('spec_view').maybeSingle();
      if (error) throw error;
      if (isSpecView(row?.spec_view)) return row.spec_view;
      // First time on the account: bring this phone's pick across.
      if (local) {
        const saved = await supabase.from('user_prefs').upsert({ user_id: userId, spec_view: local });
        if (saved.error) throw saved.error;
      }
      return local;
    },
  });
  const save = useMutation({
    mutationFn: async (view: SpecView) => {
      if (!userId) return keepOnDevice('', view);
      const { error } = await supabase.from('user_prefs').upsert({ user_id: userId, spec_view: view });
      if (error) throw error;
    },
    // Shows at once. ponytail: a pick made with no signal waits in this session only; closed before it sends, the account's pick comes back. Make it a bar write (hooks/barWrites.ts) if that bites.
    onMutate: async (view) => {
      // A read already on its way would put the old pick back.
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, view);
    },
    onError: () => client.invalidateQueries({ queryKey: key }),
  });
  return [pickSpecView(data, maker), (view) => view !== data && save.mutate(view)];
}
