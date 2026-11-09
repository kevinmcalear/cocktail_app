import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { beerWineBar, isBeerWineSlot, type BeerWineDraft, type BeerWineStep } from '@/lib/beerWineDraft';
import type { WizardDraft, WizardStep } from '@/lib/drinkWizard';
import { houseMadeBar, isHouseMadeSlot, type HouseMadeDraft, type HouseMadeStep } from '@/lib/houseMadeDraft';
import { BEER_WINE_DRAFTS, DRINK_DRAFTS, HOUSE_MADE_DRAFTS, forAccount, mergeDrafts, type DraftRules, type KeptDraft } from '@/lib/draftSync';
import { jsonAs, supabase } from '@/lib/supabase';
import { slotStart } from '@/lib/wizardSlots';
import type { Json } from '@/types/db';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';
import type { WizardStore } from '@/store/createWizardStore';
import { useDraftSyncStore } from '@/store/useDraftSyncStore';
import { useHouseMadeWizardStore } from '@/store/useHouseMadeWizardStore';
import { isReviewSlot, moveImportsOut, useDrinkWizardStore } from '@/store/useDrinkWizardStore';

/**
 * Every add wizard's drafts are `drafts` rows of this kind, one per person
 * and slot. A beer's or wine's slot says so ('beer:home'): widening the
 * table's entity_type check for a kind of its own would rewrite a
 * constraint, and the slot already tells them apart.
 */
const KIND = 'drink_wizard';
/** Typing in the wizard changes the draft on every key: the account gets it once things settle. */
const SETTLE_MS = 1500;

interface Wizard<D extends object, S extends string> {
  store: WizardStore<D, S>;
  rules: DraftRules<D>;
  /** Its slots among the account's rows. */
  owns: (slot: string) => boolean;
  /** The venue a slot is at; null at home. */
  barOf: (slot: string) => string | null;
  /** Kept on this device only. */
  deviceOnly?: (slot: string) => boolean;
  /** Runs once the account's drafts are on this device. */
  settled?: () => void;
}

type Account = { at: number; drafts: Record<string, unknown> };

/**
 * One wizard's drafts kept in the account: read back into the device's,
 * then each change sent once typing settles. A draft kept on the device
 * before (a beer kept on this phone only, until 8 Nov) is sent on the
 * first read, like one made offline.
 */
function syncer<D extends object, S extends string>(w: Wizard<D, S>) {
  /** When each slot was last sent: a read begun before that doesn't know about it yet. */
  const sentAt = new Map<string, number>();
  /** True while the account's drafts are put on the device: those changes aren't sent back. */
  let applying = false;

  const hydrated = () => w.store.persist.hasHydrated() && useDraftSyncStore.persist.hasHydrated();
  /** Runs once both stores have read the device's copy. */
  function whenHydrated(run: () => void): () => void {
    if (hydrated()) {
      run();
      return () => {};
    }
    const check = () => hydrated() && run();
    const a = w.store.persist.onFinishHydration(check);
    const b = useDraftSyncStore.persist.onFinishHydration(check);
    return () => {
      a();
      b();
    };
  }

  async function push(userId: string, slot: string, k: KeptDraft<D, S>) {
    if (w.deviceOnly?.(slot)) return;
    sentAt.set(slot, Date.now());
    const { error } = await supabase.from('drafts').upsert(
      // ponytail: KeptDraft is plain JSON (it is persisted as is) but has no index signature, so TS won't see it as Json; a toJson helper if more writes need it.
      { user_id: userId, entity_type: KIND, slot, bar_id: w.barOf(slot), draft_data: forAccount(k, w.rules) as unknown as Json },
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
    const { cleared, forgot } = w.store.getState();
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

  /** What the account has, into this device; then what it lacks, up. */
  function merge(userId: string, data: Account) {
    return whenHydrated(() => {
      const { cleared } = w.store.getState();
      // Another wizard's slot here came in through an older version, which read every row as its own: it goes.
      const kept = Object.fromEntries(Object.entries(w.store.getState().kept).filter(([slot]) => w.owns(slot)));
      const account = Object.fromEntries(Object.entries(data.drafts).filter(([slot]) => w.owns(slot))) as Record<string, KeptDraft<D, S>>;
      const sentSince = [...sentAt].filter(([, t]) => t >= data.at).map(([slot]) => slot);
      const seen = useDraftSyncStore.getState().seen.filter(w.owns);
      const merged = mergeDrafts<D, S>(kept, account, { seen, cleared, sentSince }, w.rules);
      applying = true;
      w.store.setState({ kept: merged.kept });
      applying = false;
      w.settled?.();
      // The other wizard's slots stay as they are.
      useDraftSyncStore.setState((s) => ({ seen: [...new Set([...s.seen.filter((x) => !w.owns(x)), ...merged.seen, ...sentSince.filter((x) => s.seen.includes(x))])] }));
      void forget(userId).then(() => Promise.all(merged.push.map((slot) => push(userId, slot, merged.kept[slot]).catch(() => {}))));
    });
  }

  /** Each change here goes up once typing settles. */
  function watch(userId: string) {
    const dirty = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = w.store.subscribe((s, prev) => {
      if (applying) return;
      for (const [slot, k] of Object.entries(s.kept)) if (k !== prev.kept[slot]) dirty.add(slot);
      if (!dirty.size && s.cleared === prev.cleared) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const slots = [...dirty];
        dirty.clear();
        // Cleared first: a slot started over and typed in again is taken out, then sent, in that order.
        void forget(userId).then(() => {
          const { kept } = w.store.getState();
          for (const slot of slots) if (w.owns(slot) && kept[slot] && w.rules.filled(kept[slot].draft)) void push(userId, slot, kept[slot]).catch(() => {});
        });
      }, SETTLE_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }

  return { merge, watch };
}

const drinkBar = (slot: string) => {
  const { place } = slotStart(slot);
  return place === 'home' ? null : place;
};

const WIZARDS = [
  // An import's drink being checked waits in its review, which is on this device only. Another device's import left in a plain slot comes back here as its own draft too.
  syncer<WizardDraft, WizardStep>({ store: useDrinkWizardStore, rules: DRINK_DRAFTS, owns: (slot) => !isBeerWineSlot(slot) && !isHouseMadeSlot(slot), barOf: drinkBar, deviceOnly: isReviewSlot, settled: moveImportsOut }),
  syncer<BeerWineDraft, BeerWineStep>({ store: useBeerWineWizardStore, rules: BEER_WINE_DRAFTS, owns: isBeerWineSlot, barOf: beerWineBar }),
  syncer<HouseMadeDraft, HouseMadeStep>({ store: useHouseMadeWizardStore, rules: HOUSE_MADE_DRAFTS, owns: isHouseMadeSlot, barOf: houseMadeBar }),
];

/**
 * Drafts in your account (make-anything-steps-3, step 9: "Kept in your
 * account, so your other phone and the web see it too"). Signed in, every
 * drink, beer, wine or house-made half made in a wizard is kept in the account as well
 * as on the device: read back when the app opens or comes back to the
 * front, and sent a moment after each change. Mounted once, at the root.
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
    queryFn: async (): Promise<Account> => {
      const at = Date.now();
      const { data, error } = await supabase.from('drafts').select('slot, draft_data').eq('user_id', userId!).eq('entity_type', KIND);
      if (error) throw error;
      return { at, drafts: Object.fromEntries((data ?? []).flatMap((r) => (r.slot ? [[r.slot, jsonAs<unknown>(r.draft_data)]] : []))) };
    },
  });

  const data = account.data;
  useEffect(() => {
    if (!userId || !data) return;
    const stops = WIZARDS.map((w) => w.merge(userId, data));
    return () => stops.forEach((stop) => stop());
  }, [userId, data]);

  useEffect(() => {
    if (!userId) return;
    const stops = WIZARDS.map((w) => w.watch(userId));
    return () => stops.forEach((stop) => stop());
  }, [userId]);
}
