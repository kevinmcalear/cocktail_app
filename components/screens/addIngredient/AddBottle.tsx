import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Field, IngredientDrawing, PressableScale } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useCreateIngredient } from '@/hooks/useCreateIngredient';
import { useDropdowns } from '@/hooks/useDropdowns';
import { plainDbMessage } from '@/lib/dbError';
import { sameIngredient } from '@/lib/ingredientNames';
import { EMPTY_INGREDIENT, suggestedAbv, type IngredientDraft } from '@/lib/ingredientWizard';
import { toastDone } from '@/lib/toast';

import type { CatalogIngredient } from '../addDrink/IngredientSearch';
import { PaperBand } from '../addDrink/PaperBand';
import { WizardChip, WizardFooter } from '../addDrink/WizardChrome';
import { WizardFrame } from '../addDrink/WizardFrame';
import { NameStep } from './NameStep';

export interface AddBottleProps {
  /** The venue it's added at; null or missing for one on your own shelf. */
  barId?: string | null;
  initialName?: string | null;
  embedded?: boolean;
  onClose: () => void;
  /** Saved, or an existing one picked instead of a copy. */
  onSaved: (item: { id: string; name: string }, existed: boolean) => void;
  /** It's something you make: the house recipe steps instead, with the name typed so far. */
  onMake: (name: string) => void;
}

/**
 * A bottle you buy (make-anything-overview, What changes: "A bottle you buy
 * keeps a short form"): its name (checked against what's here, or read off
 * the label), who makes it and how strong, on one screen. Anything with a
 * recipe goes to Something you make, the house recipe steps.
 */
export function AddBottle({ barId = null, initialName, embedded, onClose, onSaved, onMake }: AddBottleProps) {
  const [draft, setDraft] = useState<IngredientDraft>({ ...EMPTY_INGREDIENT, name: initialName?.trim() ?? '', role: 'product' });
  const set = (change: Partial<IngredientDraft>) => setDraft((d) => ({ ...d, ...change }));
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const create = useCreateIngredient();
  const ingredients: readonly CatalogIngredient[] = dropdowns?.ingredients ?? [];
  const coreIds = new Set(dropdowns?.coreIngredientIds ?? []);
  const aliases = dropdowns?.ingredientAliases ?? [];
  // One of each ingredient: a name that's already one (by any spelling or alias) can't be saved again, only used.
  const duplicate = draft.name.trim() ? sameIngredient(draft.name, ingredients, aliases) : null;
  const canSave = draft.name.trim().length > 0 && !duplicate && !create.isPending;
  const usual = suggestedAbv(draft.name, draft.generic?.name ?? null);
  const name = draft.name.trim() || 'Bottle';

  const save = () =>
    create.mutate(
      { draft, barId },
      {
        onSuccess: ({ id }) => {
          toastDone('Bottle saved', draft.name.trim());
          onSaved({ id, name: draft.name.trim() }, false);
        },
        onError: (e) => Alert.alert('Couldn’t save the bottle', plainDbMessage(e) ?? e.message),
      }
    );

  return (
    <WizardFrame
      testID="add-bottle"
      pageTitle="A bottle you buy"
      embedded={embedded}
      band={(p) => (
        <PaperBand
          {...p}
          first
          onBack={onClose}
          progress={{ now: 1, of: 1, label: 'A bottle you buy' }}
          art={<IngredientDrawing id={draft.generic?.id ?? null} name={name} drawn />}
          artKey={`${draft.generic?.id ?? ''}|${name}`}
          artLabel="Drawing of the bottle"
        />
      )}
      stepKey="bottle"
      direction={1}
      eyebrow={draft.name.trim() || 'A bottle you buy'}
      title="What’s the bottle?"
      onHardwareBack={() => false}
      footer={<WizardFooter nextLabel={create.isPending ? 'Saving…' : 'Save the bottle'} optional={false} canNext={canSave} saving={create.isPending} onSkip={onClose} onNext={save} />}
    >
      <View style={styles.stack}>
        <NameStep
          draft={draft}
          set={set}
          ingredients={ingredients}
          aliases={aliases}
          core={ingredients.filter((i) => coreIds.has(i.id))}
          onDone={() => {}}
          onUseExisting={(row) => onSaved(row, true)}
          resumed={false}
          onStartOver={() => setDraft({ ...EMPTY_INGREDIENT, role: 'product' })}
        />
        <Field label="Who makes it" placeholder="e.g. Campari, Buffalo Trace" value={draft.maker} onChangeText={(maker) => set({ maker })} returnKeyType="next" maxLength={80} />
        <Field label="How strong (ABV %)" placeholder={usual ? String(usual) : 'e.g. 40'} value={draft.abv} onChangeText={(abv) => set({ abv: abv.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" maxLength={5} />
        {usual && !draft.abv ? (
          <View role="group" accessibilityLabel="Usual strength" style={styles.chips}>
            <WizardChip label={`${usual}%`} kind="button" suggested onPress={() => set({ abv: String(usual) })} />
          </View>
        ) : null}
        <PressableScale role="link" onPress={() => onMake(draft.name.trim())} accessibilityLabel="It’s something you make: the house recipe steps" style={styles.make}>
          <Body tone="accent">It’s something you make</Body>
        </PressableScale>
      </View>
    </WizardFrame>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  make: { minHeight: layout.minTapTarget, justifyContent: 'center', alignSelf: 'flex-start' },
});
