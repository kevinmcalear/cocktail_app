import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { hasContent } from '@/lib/drinkWizard';
import { forAccount, mergeDrafts, type KeptDraft } from '@/lib/draftSync';
import { jsonAs, supabase } from '@/lib/supabase';
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

/** When each slot was last sent: a read begun before that doesn't know about it yet. */
const sentAt = new Map<string, number>();
/** True while the account's drafts are put on the device: those changes aren't sent back. */
let applying = false;

async function push(userId: string, slot: string, k: KeptDraft) {
  sentAt.set(slot, Date.now());
  const place = slot.split('|')[0];
  const { error } = await supabase.from('drafts').upsert(
    // ponytail: KeptDraft is plain JSON (it is persisted as is) but has no index signature, so TS won't see it as Json; a toJson helper if more writes need it.
    { user_id: userId, entity_type: KIND, slot, bar_id: place === 'home' ? null : place, draft_data: forAccount(k) as unknown as Json },
    { onConflict: 'user_id,entity_type,slot' }
  );
  if (error) throw error;
  useDraftSyncStore.setState((s) => ({ seen: s.seen.includes(slot) ? s.seen : [...s.seen, slot] }));
}

/**
 * Drafts cleared here (saved, or started over) come out of the account too,
 * never a newer one another device started in the same slot; ones that fail
 * wait for the next change. A draft the account never had (cleared while
 * signed out) has nothing to take out.
 */
async function forget(userId: string) {
  const { cleared, forgot } = useDrinkWizardStore.getState();
  const { seen } = useDraftSyncStore.getState();
  const never = cleared.filter((c) => !seen.includes(c.place)).map((c) => c.place);
  if (never.length) forgot(never);
  for (const c of cleared.filter((x) => seen.includes(x.place))) {
    const { error } = await supabase.from('drafts').delete().eq('user_id', userId).eq('entity_type', KIND).eq('slot', c.place).lte('draft_data->updatedAt', c.at);
    if (error) continue;
    forgot([c.place]);
    useDraftSyncStore.setState((s) => ({ seen: s.seen.filter((x) => x !== c.place) }));
  }
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
    // Back to the front, read again: another device may have started or saved one.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<{ at: number; drafts: Record<string, KeptDraft> }> => {
      const at = Date.now();
      const { data, error } = await supabase.from('drafts').select('slot, draft_data').eq('user_id', userId!).eq('entity_type', KIND);
      if (error) throw error;
      return { at, drafts: Object.fromEntries((data ?? []).flatMap((r) => (r.slot ? [[r.slot, jsonAs<KeptDraft>(r.draft_data)]] : []))) };
    },
  });

  // What the account has, into this device; then what it lacks, up.
  const data = account.data;
  useEffect(() => {
    if (!userId || !data) return;
    return whenHydrated(() => {
      const { kept, cleared } = useDrinkWizardStore.getState();
      const sentSince = [...sentAt].filter(([, t]) => t >= data.at).map(([slot]) => slot);
      const merged = mergeDrafts(kept as Record<string, KeptDraft>, data.drafts, { seen: useDraftSyncStore.getState().seen, cleared, sentSince });
      applying = true;
      useDrinkWizardStore.setState({ kept: merged.kept });
      applying = false;
      useDraftSyncStore.setState((s) => ({ seen: [...new Set([...merged.seen, ...sentSince.filter((x) => s.seen.includes(x))])] }));
      void forget(userId).then(() => Promise.all(merged.push.map((slot) => push(userId, slot, merged.kept[slot]).catch(() => {}))));
    });
  }, [userId, data]);

  // Each change here goes up once typing settles.
  useEffect(() => {
    if (!userId) return;
    const dirty = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useDrinkWizardStore.subscribe((s, prev) => {
      if (applying) return;
      for (const [slot, k] of Object.entries(s.kept)) if (k !== prev.kept[slot]) dirty.add(slot);
      if (!dirty.size && s.cleared === prev.cleared) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const slots = [...dirty];
        dirty.clear();
        // Cleared first: a slot started over and typed in again is taken out, then sent, in that order.
        void forget(userId).then(() => {
          const { kept } = useDrinkWizardStore.getState();
          for (const slot of slots) if (kept[slot] && hasContent(kept[slot].draft)) void push(userId, slot, kept[slot] as KeptDraft).catch(() => {});
        });
      }, SETTLE_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [userId]);
}
