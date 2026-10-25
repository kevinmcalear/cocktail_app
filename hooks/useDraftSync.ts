import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { hasContent } from '@/lib/drinkWizard';
import { forAccount, mergeDrafts, type KeptDraft } from '@/lib/draftSync';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';
import { useDraftSyncStore } from '@/store/useDraftSyncStore';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';

const KIND = 'drink_wizard';
/** Typing in the wizard changes the draft on every key: the account gets it once things settle. */
const SETTLE_MS = 1500;

const hydrated = () => useDrinkWizardStore.persist.hasHydrated() && useDraftSyncStore.persist.hasHydrated();
/** Runs once both stores have read the device's copy. */
function whenHydrated(run: () => void): () => void {
  if (hydrated()) {
    run();
    return () => {};
  }
  const check = () => hydrated() && run();
  const a = useDrinkWizardStore.persist.onFinishHydration(check);
  const b = useDraftSyncStore.persist.onFinishHydration(check);
  return () => {
    a();
    b();
  };
}

async function push(userId: string, slot: string, k: KeptDraft) {
  const place = slot.split('|')[0];
  const { error } = await supabase.from('drafts').upsert(
    { user_id: userId, entity_type: KIND, slot, bar_id: place === 'home' ? null : place, draft_data: forAccount(k) as unknown as Json, updated_at: new Date(k.updatedAt).toISOString() },
    { onConflict: 'user_id,entity_type,slot' }
  );
  if (error) throw error;
  useDraftSyncStore.setState((s) => ({ seen: s.seen.includes(slot) ? s.seen : [...s.seen, slot] }));
}

/** Drafts cleared here (saved, or started over) come out of the account too; ones that fail wait for the next change. */
async function forget(userId: string) {
  const { cleared } = useDrinkWizardStore.getState();
  if (!cleared.length) return;
  const { error } = await supabase.from('drafts').delete().eq('user_id', userId).eq('entity_type', KIND).in('slot', cleared);
  if (error) return;
  useDrinkWizardStore.getState().forgot(cleared);
  useDraftSyncStore.setState((s) => ({ seen: s.seen.filter((x) => !cleared.includes(x)) }));
}

/**
 * Drafts in your account (make-anything-steps-3, step 9: "Kept in your
 * account, so your other phone and the web see it too"). Signed in, every
 * drink half made in the wizard is kept in the account as well as on the
 * device: read back when the app opens or comes back to the front, and sent
 * a moment after each change. Mounted once, at the root.
 * ponytail: a draft changed on two devices while both were offline keeps the
 * later change, whole; merging fields is the upgrade if that ever bites.
 */
export function useDraftSync() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const account = useQuery({
    queryKey: ['wizard-drafts', userId],
    enabled: !!userId,
    staleTime: 0,
    queryFn: async (): Promise<Record<string, KeptDraft>> => {
      const { data, error } = await supabase.from('drafts').select('slot, draft_data').eq('user_id', userId!).eq('entity_type', KIND);
      if (error) throw error;
      return Object.fromEntries((data ?? []).flatMap((r) => (r.slot ? [[r.slot, r.draft_data as unknown as KeptDraft]] : [])));
    },
  });

  // What the account has, into this device; then what it lacks, up.
  const data = account.data;
  useEffect(() => {
    if (!userId || !data) return;
    return whenHydrated(() => {
      const { kept, cleared } = useDrinkWizardStore.getState();
      const merged = mergeDrafts(kept as Record<string, KeptDraft>, data, { seen: useDraftSyncStore.getState().seen, cleared });
      useDrinkWizardStore.setState({ kept: merged.kept });
      useDraftSyncStore.setState({ seen: merged.seen });
      void forget(userId);
      for (const slot of merged.push) void push(userId, slot, merged.kept[slot]).catch(() => {});
    });
  }, [userId, data]);

  // Each change here goes up once typing settles.
  useEffect(() => {
    if (!userId) return;
    const dirty = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useDrinkWizardStore.subscribe((s, prev) => {
      for (const [slot, k] of Object.entries(s.kept)) if (k !== prev.kept[slot]) dirty.add(slot);
      if (!dirty.size && s.cleared === prev.cleared) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const { kept } = useDrinkWizardStore.getState();
        for (const slot of dirty) if (kept[slot] && hasContent(kept[slot].draft)) void push(userId, slot, kept[slot] as KeptDraft).catch(() => {});
        dirty.clear();
        void forget(userId);
      }, SETTLE_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [userId]);
}
