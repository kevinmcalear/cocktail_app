import { useNetInfo } from '@react-native-community/netinfo';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { Caption, useBreakpoint, useDs, useToast } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { useLogBatchNow } from '@/components/screens/prep/LogBatchButton';
import { STATUS } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateBar } from '@/hooks/useBringInPlace';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDropdowns } from '@/hooks/useDropdowns';
import { takenPrepWords, useSameNamePrep } from '@/hooks/useSameNamePrep';
import { PARTS_SAVED, savedTogether, useHouseMadeWaiting, useSaveHouseMade } from '@/hooks/useSaveHouseMade';
import { readableAccent } from '@/lib/color';
import { saveErrorWords } from '@/lib/saveErrorWords';
import { newDraftId } from '@/lib/drinkWizard';
import { houseMadeBar, houseMadesAt, houseMadeSlot, isHouseMadeSlot } from '@/lib/houseMadeDraft';
import { partsOf } from '@/lib/houseMadeParts';
import { prepYield } from '@/lib/prepKinds';
import { nameKey } from '@/lib/sameName';
import { useHouseMadeWizardStore } from '@/store/useHouseMadeWizardStore';

import { PrepBuilder } from '../addDrink/prep/PrepBuilder';
import { WizardDialog } from '../addDrink/WizardDialog';
import { WizardWaiting } from '../addDrink/WizardWaiting';
import { TechniquesGate } from '@/components/techniques/TechniquesGate';

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
function MakeRecipeRouteBody() {
  // The kept draft loads from storage first, so nothing written is lost to it.
  const ready = useSyncExternalStore(hydrated, isHydrated, () => true);
  const { barId, shelf, slot } = useLocalSearchParams<{ barId?: string; shelf?: string; slot?: string }>();
  // Where it's made: the bar in the link; your bar for the shelf's Make it in house; a picked-up draft's own place;
  // else where you are now, once that's known (a cold link at a bar is the bar's).
  const place = useCreateBar(barId || (shelf ? null : slot && isHouseMadeSlot(slot) ? houseMadeBar(slot) : undefined));
  // A wide web window keeps the page under it showing until the dialog can open.
  const desktop = useBreakpoint() === 'desktop';
  if (!ready || !place.ready) return Platform.OS === 'web' && desktop ? null : <WizardWaiting />;
  return <MakeRecipe barId={place.barId} />;
}

function MakeRecipe({ barId }: { barId: string | null }) {
  const router = useRouter();
  const ds = useDs();
  const toast = useToast();
  const { name: nameParam, shelf, slot: slotParam } = useLocalSearchParams<{ name?: string; shelf?: string; slot?: string }>();
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
  // Made in parts (Add-parts): how many save together, for Saving 3… and the offline note.
  const count = useHouseMadeWizardStore((s) => 1 + partsOf(s.kept[slot]?.draft.prep ?? null).length);
  const [typedName, setTypedName] = useState(kept?.draft.name ?? nameParam ?? '');
  const wrote = useRef(false);
  // One save at a time: a quick second tap lands before the screen knows it's saving.
  const saving = useRef(false);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Board Add-house, Name taken: one card at a bar and at home, never a quiet "My …" (Add-house-notes, pick 5).
  const same = useSameNamePrep({ barId, name: typedName });
  const taken = same.data;
  const card = taken ? { ...takenPrepWords(taken, venue?.name ?? null), onOpen: () => router.replace(`/ingredient/${taken.id}` as Href), openLabel: `Open ${taken.name}. Your draft is kept` } : null;

  const saved = (id: string, name: string, makes: number | null, together: number) => {
    // Log batch: one batch at the bar, where the recipe says what it makes; otherwise its Make mode.
    const logBatch = () => (barId && canLog && makes ? logNow(id, name, { amount: makes, unit: 'ml' })() : router.push(`/ingredient/${id}/make` as Href));
    // Board Add-parts, 4: "Saved 3 house-mades. Each is on House-made with its own page and Used in." Green, as drawn; b1's Log batch stays.
    const title = together > 1 ? savedTogether(together) : 'Recipe saved';
    toast.show({ title, detail: together > 1 ? PARTS_SAVED : barId ? 'It’s on House-made; log a batch when you make it.' : 'Log a batch when you make it.', tone: 'success', action: { label: 'Log batch', onPress: logBatch } });
    if (shelf) return goBack();
    // Its page with the Done rows (board Add-house, Done: Makes, Keeps, Used in).
    router.replace(`/ingredient/${id}?saved=1` as Href);
  };

  const label = waiting && !save.isPending ? 'Saves when you’re back' : save.isPending && !offline ? (count > 1 ? `Saving ${count}…` : 'Saving…') : offline ? 'Save on this phone' : 'Save it';
  const builder = (
    <PrepBuilder
      embedded={dialog}
      closeRef={closeRef}
      name={kept?.draft.name ?? nameParam ?? ''}
      initial={kept?.draft.prep ?? null}
      startAt={kept?.draft.prep ? kept.step : undefined}
      bar={venue ? { id: venue.id, name: venue.name } : null}
      ingredients={dropdowns?.ingredients ?? []}
      aliases={dropdowns?.ingredientAliases}
      taken={card}
      checking={same.checking}
      saveLabel={label}
      // Saved on this phone and picked up again before it's in: the button says so and can't be pressed (review of #1183).
      saving={(save.isPending && !offline) || waiting}
      notice={offline ? <Caption color={readableAccent(STATUS.warning, ds.c.ground)}>{count > 1 ? `You’re offline. All ${count} are kept on this phone and save together when you’re back.` : 'You’re offline. It’s kept on this phone and saves when you’re back.'}</Caption> : undefined}
      onName={setTypedName}
      onKeep={(prep, name, step) => {
        // The slot goes in the address once something is kept: a reload on the web picks this one up. Not through the
        // router: a new param there remounts the steps, so a part opened as the first thing written (Add-parts) closed again.
        if (!wrote.current && slotParam !== slot && Platform.OS === 'web') {
          const url = new URL(window.location.href);
          url.searchParams.set('slot', slot);
          window.history.replaceState(window.history.state, '', url);
        }
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
        save.mutate(
          { name: n, prep, barId, slot, kept: useHouseMadeWizardStore.getState().kept[slot]?.draft, queued, shelf: !!shelf },
          {
            onSuccess: ({ id, name, warnings }) => {
              if (queued) return;
              if (warnings.length) Alert.alert('Saved, with one thing to fix', warnings.join('\n\n'));
              saved(id, name, prepYield(prep), 1 + partsOf(prep).length);
            },
            onError: (e) => {
              saving.current = false;
              if (!queued) Alert.alert('Couldn’t save it', `${saveErrorWords(e)} Your draft is kept.`);
            },
          }
        );
        if (queued) {
          const parts = partsOf(prep).length;
          toast.show({ title: 'Kept on this phone', detail: parts ? `${n} and its ${parts === 1 ? 'part save' : `${parts} parts save`} together when you’re back.` : `${n} saves when you’re back.` });
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

/** MakeRecipeRoute, once the technique library is in (lib/techniques). */
export function MakeRecipeRoute() {
  return (
    <TechniquesGate>
      <MakeRecipeRouteBody />
    </TechniquesGate>
  );
}
