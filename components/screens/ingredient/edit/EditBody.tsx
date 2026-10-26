import { Field } from '@/components/ds';
import type { PrepFields } from '@/lib/prepCardForm';

import { EditLines } from '../../drink/edit/EditLines';
import { IngredientTags } from '../IngredientBits';
import { SameNameNotice } from '../IngredientEditSheets';
import { BottlePrice, SpiritTags, WhatItIs } from './BottleSections';
import { KindOf, NameField, WhereEdit, WhoSees } from './EditSections';
import { MethodEdit } from './MethodEdit';
import { keepsValues, KeepsRows, PrepCost, type KeepsField } from './PrepSections';
import type { IngredientEdit } from './useIngredientEdit';

export type BodySheet = KeepsField | 'kind' | 'tags';

interface EditBodyProps {
  edit: IngredientEdit;
  /** The saved ingredient; null for a draft, which has no venue rows yet. */
  savedId: string | null;
  isPrep: boolean;
  wide: boolean;
  venueName: string | null;
  /** How many drinks use it, for the recipe's note. */
  used: number;
  spiritTags: { id: string; name: string }[];
  onSheet: (s: BodySheet) => void;
  /** The saved ingredient's id, or the draft's: never a line of its own recipe. */
  selfId: string;
  /** Bumped by the bottom bar's Line: the cursor goes to the recipe's search. */
  focus?: number;
}

/**
 * The page's fields in the board's order (ingredient-edit-proposal). A house
 * prep: tags, Kind of, Name, About it, Recipe, Method, How it keeps (the aside
 * on wide screens), Cost, Where it lives, Who sees it. A bottle: Name, About
 * it, What it is, Spirit tags, Where it lives, Cost, Who sees it.
 */
export function EditBody({ edit, savedId, isPrep, wide, venueName, used, spiritTags, onSheet, selfId, focus }: EditBodyProps) {
  const { editor, setPrep } = edit;
  const prep = edit.prep as PrepFields;
  const { form, set } = editor;
  const lines = form.recipeItems;
  const name = form.name || 'Ingredient';
  const values = keepsValues(prep);
  const steps = prep.steps.filter((s) => s.body.trim()).length;
  const methodSummary = [steps ? `${steps} ${steps === 1 ? 'step' : 'steps'}` : null, values.takes].filter(Boolean).join(' · ') || null;
  const nameField = (
    <>
      <NameField value={form.name} onChange={(n) => set({ name: n })} />
      <SameNameNotice name={form.name} barId={form.barId} rows={editor.dropdowns?.ingredients ?? []} aliases={editor.dropdowns?.ingredientAliases} excludeId={editor.selfId} generic={form.generic} onGeneric={(generic) => set({ generic })} />
    </>
  );
  const about = <Field label="About it" value={form.description} onChangeText={(description) => set({ description })} placeholder="What it is and how it tastes" minLines={3} />;
  const where = savedId ? <WhereEdit itemId={savedId} name={name} /> : null;
  const who = savedId ? <WhoSees itemId={savedId} barId={form.barId} hide={form.hideFromSearch} onHide={(hideFromSearch) => set({ hideFromSearch })} /> : null;

  if (!isPrep) {
    return (
      <>
        {nameField}
        {about}
        <WhatItIs form={form} set={set} onKind={() => onSheet('kind')} />
        <SpiritTags tags={spiritTags} selected={form.selectedCategories} onToggle={(id) => set({ selectedCategories: form.selectedCategories.filter((c) => c !== id) })} onAdd={() => onSheet('tags')} />
        {where}
        {savedId ? <BottlePrice itemId={savedId} name={name} onPending={edit.onPending} /> : null}
        {who}
      </>
    );
  }
  return (
    <>
      {wide ? null : nameField}
      <IngredientTags isPrep actions={[]} venueName={venueName} shared={!form.barId} mine={false} role={editor.role} technical={false} />
      <KindOf name={form.generic?.name ?? null} onPick={() => onSheet('kind')} />
      {wide ? nameField : null}
      {about}
      <EditLines
        title="Recipe"
        aside={values.makes ? `Makes about ${values.makes}` : null}
        note={used === 1 ? 'The drink that uses it updates when you press Done.' : used ? `The ${used} drinks that use it update when you press Done.` : null}
        items={lines}
        onChange={editor.setRecipeItems}
        name={name}
        ingredients={editor.catalog.filter((i) => i.id !== selfId)}
        aliases={editor.dropdowns?.ingredientAliases}
        loading={!editor.dropdowns?.ingredients}
        bar={form.barId ? { id: form.barId, name: venueName ?? '' } : null}
        forDrink={false}
        focus={focus}
      />
      {savedId ? <MethodEdit steps={prep.steps} onChange={(s) => setPrep({ steps: s })} summary={methodSummary} /> : null}
      {savedId && !wide ? <KeepsRows fields={prep} wide={false} onOpen={onSheet} /> : null}
      {wide ? null : where}
      {savedId ? <PrepCost itemId={savedId} fields={prep} lines={lines} /> : null}
      {wide ? where : null}
      {who}
    </>
  );
}
