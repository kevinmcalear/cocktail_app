import { useNetInfo } from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { Caption, useBreakpoint, useDs, useToast } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { useLogBatchNow } from '@/components/screens/prep/LogBatchButton';
import { STATUS } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDropdowns } from '@/hooks/useDropdowns';
import { takenPrepWords, useSameNamePrep } from '@/hooks/useSameNamePrep';
import { useHouseMadeWaiting, useSaveHouseMade } from '@/hooks/useSaveHouseMade';
import { readableAccent } from '@/lib/color';
import { plainDbMessage } from '@/lib/dbError';
import { newDraftId } from '@/lib/drinkWizard';
import { houseMadeBar, houseMadesAt, houseMadeSlot, isHouseMadeSlot } from '@/lib/houseMadeDraft';
import { prepYield } from '@/lib/prepKinds';
import { nameKey } from '@/lib/sameName';
import { useHouseMadeWizardStore } from '@/store/useHouseMadeWizardStore';

import { PrepBuilder } from '../addDrink/prep/PrepBuilder';
import { WizardDialog } from '../addDrink/WizardDialog';

const hydrated = (cb: () => void) => useHouseMadeWizardStore.persist.onFinishHydration(cb);
const isHydrated = () => useHouseMadeWizardStore.persist.hasHydrated();

/**
 * /make-recipe: New › Something you make (board Add-house): What are you
 * making?, What goes in?, How it's made. On a wide web window a 640 dialog
 * over the page it was opened from. What's written is kept as it's written,
 * on the phone and in the account; closing asks Leave it for now (Kevin,
 * 8 Nov: "Later on close"), and it picks up where it was left. Save it opens
 * the new recipe's page with Log batch. `shelf` (Add to your bar's Make it
 * in house) puts it on your bar and goes back there.
 */
export function MakeRecipeRoute() {
  // The kept draft loads from storage first, so nothing written is lost to it.
  const ready = useSyncExternalStore(hydrated, isHydrated, () => true);
  return ready ? <MakeRecipe /> : null;
}

function MakeRecipe() {
  const router = useRouter();
  const ds = useDs();
  const toast = useToast();
  const { barId: barParam, name: nameParam, shelf, slot: slotParam } = useLocalSearchParams<{ barId?: string; name?: string; shelf?: string; slot?: string }>();
  const barId = barParam || null;
  const venue = useActiveVenue().venues.find((v) => v.id === barId) ?? null;
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const save = useSaveHouseMade();
  const offline = useNetInfo().isConnected === false;
  const canLog = !!useCapabilities(barId).data?.includes('specs');
  const logNow = useLogBatchNow(barId ?? '');
  const desktop = useBreakpoint() === 'desktop';
  const dialog = Platform.OS === 'web' && desktop;
  // The dialog's Escape and scrim close as the X does, asking Leave it for now.
  const closeRef = useRef<(() => void) | null>(null);

  const patch = useHouseMadeWizardStore((s) => s.patch);
  const setStep = useHouseMadeWizardStore((s) => s.setStep);
  const clear = useHouseMadeWizardStore((s) => s.clear);
  // Each one left for now keeps its own slot, so starting another never writes over it (review of #1183). Picked up: the
  // slot it was listed under; a name passed in (Make "Fig leaf oil") picks up the one left by that name; else a new one.
  const [slot] = useState(() => {
    const all = useHouseMadeWizardStore.getState().kept;
    // From the address: only a house-made's slot at this place (another kind's would be synced as that kind).
    const asked = slotParam && isHouseMadeSlot(slotParam) && houseMadeBar(slotParam) === barId ? slotParam : null;
    if (asked && all[asked]) return asked;
    const same = nameParam?.trim() ? houseMadesAt(all, barId).find(([, k]) => nameKey(k.draft.name) === nameKey(nameParam)) : undefined;
    return same?.[0] ?? asked ?? houseMadeSlot(barId, newDraftId());
  });
  // Read once, so the steps start from it and then own it.
  const [kept] = useState(() => useHouseMadeWizardStore.getState().kept[slot] ?? null);
  const waiting = useHouseMadeWaiting(slot);
  const [typedName, setTypedName] = useState(kept?.draft.name ?? nameParam ?? '');
  const wrote = useRef(false);
  // One save at a time: a quick second tap lands before the screen knows it's saving.
  const saving = useRef(false);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Board Add-house, Name taken: one card at a bar and at home, never a quiet "My …" (Add-house-notes, pick 5).
  const same = useSameNamePrep({ barId, name: typedName });
  const taken = same.data;
  const card = taken ? { ...takenPrepWords(taken, venue?.name ?? null), onOpen: () => router.replace(`/ingredient/${taken.id}` as Href), openLabel: `Open ${taken.name}. Your draft is kept` } : null;

  const saved = (id: string, name: string, makes: number | null) => {
    // Log batch: one batch at the bar, where the recipe says what it makes; otherwise its Make mode.
    const logBatch = () => (barId && canLog && makes ? logNow(id, name, { amount: makes, unit: 'ml' })() : router.push(`/ingredient/${id}/make` as Href));
    toast.show({ title: 'Recipe saved', detail: barId ? 'It’s on House-made; log a batch when you make it.' : 'Log a batch when you make it.', action: { label: 'Log batch', onPress: logBatch } });
    if (shelf) return goBack();
    // Its page with the Done rows (board Add-house, Done: Makes, Keeps, Used in).
    router.replace(`/ingredient/${id}?saved=1` as Href);
  };

  const label = waiting && !save.isPending ? 'Saves when you’re back' : save.isPending && !offline ? 'Saving…' : offline ? 'Save on this phone' : 'Save it';
  const builder = (
    <PrepBuilder
      page
      embedded={dialog}
      closeRef={closeRef}
      name={kept?.draft.name ?? nameParam ?? ''}
      initial={kept?.draft.prep ?? null}
      startAt={kept?.draft.prep ? kept.step : undefined}
      drinkName=""
      above={[]}
      bar={venue ? { id: venue.id, name: venue.name } : null}
      ingredients={dropdowns?.ingredients ?? []}
      aliases={dropdowns?.ingredientAliases}
      taken={card}
      checking={same.checking}
      saveLabel={label}
      // Saved on this phone and picked up again before it's in: the button says so and can't be pressed (review of #1183).
      saving={(save.isPending && !offline) || waiting}
      notice={offline ? <Caption color={readableAccent(STATUS.warning, ds.c.ground)}>You’re offline. It’s kept on this phone and saves when you’re back.</Caption> : undefined}
      onName={setTypedName}
      onKeep={(prep, name, step) => {
        // The slot goes in the address once something is kept: a reload on the web picks this one up.
        if (!wrote.current && slotParam !== slot) router.setParams({ slot });
        wrote.current = true;
        patch(slot, { name, prep });
        setStep(slot, step);
      }}
      onDrop={() => {
        // Only this one goes.
        clear(slot);
        goBack();
      }}
      onClose={goBack}
      onDone={(prep, n) => {
        if (saving.current || waiting) return;
        saving.current = true;
        const queued = offline;
        const keptAt = useHouseMadeWizardStore.getState().kept[slot]?.updatedAt;
        save.mutate(
          { name: n, prep, barId, slot, keptAt, queued, shelf: !!shelf },
          {
            onSuccess: ({ id, name, warnings }) => {
              if (queued) return;
              if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
              saved(id, name, prepYield(prep));
            },
            onError: (e) => {
              saving.current = false;
              if (!queued) Alert.alert('Couldn’t save it', `${plainDbMessage(e) ?? e.message} Your draft is kept.`);
            },
          }
        );
        if (queued) {
          toast.show({ title: 'Kept on this phone', detail: `${n} saves when you’re back.` });
          goBack();
        }
      }}
    />
  );
  return (
    <VenueBrandProvider>
      {dialog ? (
        <WizardDialog label="Something you make" width={640} onClose={() => closeRef.current?.()}>
          {builder}
        </WizardDialog>
      ) : (
        builder
      )}
    </VenueBrandProvider>
  );
}
