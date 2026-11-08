import { useNetInfo } from '@react-native-community/netinfo';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { Caption, IngredientDrawing, useDs, useToast } from '@/components/ds';
import { STATUS } from '@/constants/tokens';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useNearIngredientsChecked } from '@/hooks/useNearIngredients';
import { useReadLabel } from '@/hooks/useReadLabel';
import { useBottleHere, useBottleStrengths, useSaveBottle } from '@/hooks/useSaveBottle';
import { abvError, abvNumber, bottleMatches, kindHelp, notABottleWords, ownBottle, savedDetail, takenWords, type BottleRow } from '@/lib/addBottle';
import { readableAccent } from '@/lib/color';
import { plainDbMessage } from '@/lib/dbError';
import { confirmDiscardChanges } from '@/lib/dialogs';
import { newDraftId, type WizardPick } from '@/lib/drinkWizard';
import { sameBottle } from '@/lib/ingredientNames';
import { kindGuesses, suggestedAbv } from '@/lib/ingredientWizard';
import * as Device from '@/lib/realDevice';
import { pickBottlePhoto, takeBottlePhoto, type BottlePhoto } from '@/lib/readBottle';
import { capitalizeAsYouType, capitalizeFirsts } from '@/lib/stringUtils';

import { BeerWineBand } from '../addBeerWine/BeerWineBand';
import { Prompt } from '../addDrink/Prompt';
import { WizardFooter } from '../addDrink/WizardChrome';
import { WizardFrame } from '../addDrink/WizardFrame';
import { FindSheet } from '../ingredient/IngredientEditSheets';
import { BottleFields } from './BottleFields';
import { BottleName, MakeLink, SnapCard } from './BottleName';

export interface AddBottleProps {
  /** The venue it's added at; null or missing for one on your own shelf. */
  barId?: string | null;
  initialName?: string | null;
  embedded?: boolean;
  onClose: () => void;
  /** Saved, or one already here opened instead of a copy. */
  onSaved: (item: { id: string; name: string }, existed: boolean) => void;
  /** It's something I make: the house-made steps instead, with the name typed so far. */
  onMake: (name: string) => void;
  /** The web's dialog closes through it (Escape, its scrim), asking first like the X. */
  closeRef?: { current: (() => void) | null };
}

const NONE: readonly BottleRow[] = [];

/** Who said what it's a kind of: the label, you, or nobody yet (then the name's guess). */
type KindFrom = 'label' | 'you';

/**
 * A bottle you buy (board Add-bottle, with Kevin's "Trim it" and "Plainer
 * words", 8 Nov): one screen, filled in as you go. Its name first, with "Is it
 * this one?" from the shared catalog (a pick fills in the maker, strength and
 * kind) or the label snapped. A new one shows who makes it, how strong and
 * what it's a kind of; one already on the back bar (or your shelf) says so.
 * One button saves it, on this phone when there's no signal.
 */
export function AddBottle({ barId = null, initialName, embedded, onClose, onSaved, onMake, closeRef }: AddBottleProps) {
  const ds = useDs();
  const toast = useToast();
  const [name, setName] = useState(capitalizeFirsts(initialName?.trim() ?? ''));
  const [maker, setMaker] = useState('');
  const [abv, setAbv] = useState('');
  const [kind, setKind] = useState<{ pick: WizardPick | null; from: KindFrom } | null>(null);
  const [photo, setPhoto] = useState<BottlePhoto | null>(null);
  const [newOne, setNewOne] = useState(false);
  const [findKind, setFindKind] = useState(false);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const read = useReadLabel();
  const save = useSaveBottle();
  const offline = useNetInfo().isConnected === false;

  const dropdowns = useDropdowns({ ingredients: true }).data;
  const rows: readonly BottleRow[] = dropdowns?.ingredients ?? NONE;
  const aliases = dropdowns?.ingredientAliases ?? [];
  const coreIds = useMemo(() => new Set(dropdowns?.coreIngredientIds ?? []), [dropdowns?.coreIngredientIds]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const core = useMemo(() => rows.filter((r) => coreIds.has(r.id)), [rows, coreIds]);
  const kindOf = (r: BottleRow) => (r.generic_id ? (byId.get(r.generic_id)?.name ?? null) : null);
  const hereOf = useBottleHere(barId, rows);

  // The bottle this name already is: the venue's own, else the shared catalog's (by any spelling or alias).
  const typed = name.trim();
  const same = typed ? (ownBottle(typed, rows, barId) ?? sameBottle(typed, rows, aliases)) : null;
  const target = same?.ingredient_role === 'product' ? same : null;
  // A house-made, a kind or a plain ingredient by this name: not a bottle to stock.
  const other = same && !target ? same : null;
  const here = hereOf(target?.id);
  const found = same ? [] : bottleMatches(typed, rows, barId, { aliases, coreIds });
  // Nothing has it in its name: one spelled close ("laphroig"), a bottle shared or this venue's.
  const near = useNearIngredientsChecked(typed, rows, { skip: !!same || found.length > 0 || typed.length < 3, limit: 3 });
  const closest = near.near.filter((r) => r.ingredient_role === 'product' && (!r.bar_id || r.bar_id === barId)).slice(0, 1);
  const matches = newOne ? [] : found.length ? found : closest;
  const strengths = useBottleStrengths([...matches.map((r) => r.id), ...(target ? [target.id] : [])]);

  // What it's a kind of: the catalog's, else what the label or you said, else the name's guess.
  const guess = !kind && typed ? (kindGuesses(typed, core)[0] ?? null) : null;
  const kindPick = target ? (target.generic_id ? { id: target.generic_id, name: kindOf(target) ?? '' } : null) : (kind?.pick ?? (guess ? { id: guess.id, name: guess.name ?? '' } : null));
  const filled = !!target || newOne || !!photo || (!!typed && !matches.length && !near.checking);
  const strength = target ? strengths[target.id] : null;
  const shown = target ? { maker: target.brand_maker ?? '', abv: strength === null || strength === undefined ? '' : String(strength) } : { maker, abv };
  const dirty = !!(typed || maker.trim() || abv || photo);
  // A new bottle's strength as typed, if it isn't one (400, "."): said under the field, and Save waits, rather than saving it with none.
  const badAbv = target ? null : abvError(abv);
  // Not before the catalog is in: a name it has must not be saved as a second one.
  const canSave = !!typed && !!dropdowns?.ingredients && !here && !other && !badAbv && !save.isPending;

  const leave = () => void confirmDiscardChanges(dirty).then((go) => go && onClose());
  useEffect(() => {
    // Escape on the web dialog: the kind search first, if it's open over the form.
    if (closeRef) closeRef.current = () => (findKind ? setFindKind(false) : leave());
  });

  const onName = (next: string) => {
    setName(capitalizeAsYouType(next));
    if (!next.trim()) setNewOne(false);
  };

  const snap = () => {
    const from = async (get: () => Promise<BottlePhoto | null>) => {
      try {
        const got = await get();
        if (!got) return;
        setPhoto(got);
        read.mutate(got, {
          onSuccess: ([label]) => {
            // What was typed while it read stays.
            if (label.name?.trim()) setName((n) => (n.trim() ? n : capitalizeFirsts(label.name)));
            if (label.brand) setMaker((m) => (m.trim() ? m : (label.brand ?? '')));
            if (label.abv !== null) setAbv((a) => a || String(label.abv));
            const k = label.kind ? (kindGuesses(label.kind, core)[0] ?? core.find((c) => (c.name ?? '').toLowerCase() === label.kind?.toLowerCase())) : null;
            if (k) setKind((was) => (was?.from === 'you' ? was : { pick: { id: k.id, name: k.name ?? '' }, from: 'label' }));
          },
          onError: (e) => Alert.alert('Couldn’t read the label', `${e.message} Type its name instead.`),
        });
      } catch (e) {
        Alert.alert('No photo', e instanceof Error ? e.message : 'Couldn’t open the photos.');
      }
    };
    // One button (Kevin, 8 Nov): a phone asks camera or library; the web's file chooser offers both itself, and a simulator has no camera.
    if (Platform.OS === 'web' || !Device.isDevice) return void from(pickBottlePhoto);
    Alert.alert('Snap the label', undefined, [
      { text: 'Take a photo', onPress: () => void from(takeBottlePhoto) },
      { text: 'Choose a photo', onPress: () => void from(pickBottlePhoto) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submit = () => {
    if (!canSave) return;
    const queued = offline;
    const write = target
      ? { id: target.id, barId, existing: true, name: target.name ?? typed, maker: null, abv: null, genericId: null, photo: null, queued }
      : { id: newDraftId(), barId, existing: false, name: capitalizeFirsts(typed), maker: capitalizeFirsts(maker.trim()) || null, abv: abvNumber(abv), genericId: kindPick?.id ?? null, photo: photo?.uri ?? null, queued };
    save.mutate(write, {
      onSuccess: (id) => {
        if (queued) return;
        // Another id: the database had it already, shared (by a spelling this screen didn't know), so it's that bottle, with its own kind.
        const shared = id === write.id ? null : (byId.get(id) ?? { id, name: write.name });
        toast.show({ title: 'Bottle saved', detail: savedDetail(!!barId, shared ? kindOf(shared) : (kindPick?.name ?? null)) });
        onSaved({ id, name: shared?.name ?? write.name }, write.existing || !!shared);
      },
      onError: (e) => Alert.alert('Couldn’t save the bottle', plainDbMessage(e) ?? e.message),
    });
    // Offline it waits for signal (hooks/barWrites.ts), on this phone even if the app closes.
    if (queued) {
      toast.show({ title: 'Kept on this phone', detail: `${write.name} saves when you’re back.` });
      onClose();
    }
  };

  const there = here && target ? target : other;
  const taken = there ? (
    <Prompt
      warn
      icon="exclamationmark.triangle"
      {...(here && target ? takenWords(target.name ?? typed, !!barId, here) : notABottleWords(there.name ?? typed, there.ingredient_role))}
      actions={[
        { label: `${here ? 'Use' : 'Open'} ${there.name}`, onPress: () => onSaved({ id: there.id, name: there.name ?? typed }, true) },
        { label: 'It’s a different bottle', onPress: () => nameRef.current?.focus() },
      ]}
    />
  ) : null;
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  const label = save.isPending ? 'Saving…' : offline ? 'Save on this phone' : 'Save the bottle';
  const notice = offline && typed ? <Caption color={amber}>You’re offline. It’s kept on this phone and saves when you’re back.</Caption> : !typed ? <Caption tone="muted">Name it to save. The rest can wait for its page.</Caption> : undefined;
  const art = target?.id ?? kindPick?.id ?? null;
  const listing = !!typed && matches.length > 0;

  return (
    <View style={styles.flex}>
      <WizardFrame
        testID="add-bottle"
        pageTitle="A bottle you buy"
        embedded={embedded}
        overNav
        band={(p) => <BeerWineBand place={p} title="A bottle you buy" art={<IngredientDrawing id={art} name={typed || 'Bottle'} drawn bare />} artLabel="Drawing of the bottle" onClose={leave} />}
        stepKey="bottle"
        direction={1}
        eyebrow="A bottle you buy"
        title={filled && typed ? (target?.name ?? capitalizeFirsts(typed)) : 'What’s the bottle?'}
        onHardwareBack={() => {
          leave();
          return true;
        }}
        footer={<WizardFooter nextLabel={label} optional={false} canNext={canSave} saving={save.isPending} onSkip={leave} onNext={submit} notice={notice} />}
      >
        <BottleName
          name={name}
          onName={onName}
          nameRef={nameRef}
          matches={taken || filled ? [] : matches}
          strengths={strengths}
          kindOf={kindOf}
          onPick={(r) => setName(r.name ?? typed)}
          onNewOne={() => setNewOne(true)}
        >
          {taken ??
            (filled && typed ? (
              <BottleFields
                maker={shown.maker}
                abv={shown.abv}
                abvError={badAbv}
                kind={kindPick?.name ?? null}
                kindHelp={kindHelp(kindPick?.name ?? null, target ? 'catalog' : (kind?.from ?? 'name'))}
                fixed={!!target}
                onMaker={setMaker}
                onAbv={setAbv}
                onKind={() => setFindKind(true)}
                usualAbv={suggestedAbv(typed, kindPick?.name ?? null)}
                photo={photo}
                reading={read.isPending}
                onRemovePhoto={() => setPhoto(null)}
              />
            ) : (
              <>
                {/* Is it this one? stands alone (Add-bottle, 2). */}
                {listing ? null : <SnapCard reading={read.isPending} onSnap={snap} />}
                {listing ? null : <MakeLink onPress={() => onMake(typed)} />}
              </>
            ))}
        </BottleName>
      </WizardFrame>
      {findKind ? (
        <FindSheet
          title="What it’s a kind of"
          ingredients={rows}
          aliases={aliases}
          loading={!dropdowns?.ingredients}
          excludeId={null}
          allowNew={false}
          onClear={kindPick ? () => (setFindKind(false), setKind({ pick: null, from: 'you' })) : undefined}
          onClose={() => setFindKind(false)}
          onPick={(p) => (setFindKind(false), setKind({ pick: p, from: 'you' }))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
