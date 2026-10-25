import { useRouter } from 'expo-router';

import { getPreferredUnit } from '@/store/useSettingsStore';

import type { MoreChoice } from '../../drink/edit/EditParts';
import { SpecPad } from '../../drink/edit/SpecPad';
import { AccessSheet, FindSheet, TagsSheet } from '../IngredientEditSheets';
import { PictureSheet } from '../PictureSheet';
import type { BodySheet } from './EditBody';
import { KeepsSheet } from './PrepSections';
import type { IngredientEdit } from './useIngredientEdit';

interface EditSheetsProps {
  edit: IngredientEdit;
  /** The saved ingredient's id, or the draft's: who a new ingredient made from here comes back to. */
  selfId: string;
  name: string;
  sheet: MoreChoice | BodySheet | 'more' | null;
  onSheet: (s: null) => void;
  pad: number | null;
  onPad: (line: number | null) => void;
  swap: number | null;
  onSwap: (line: number | null) => void;
  spiritTags: { id: string; name: string }[];
}

/** What the editor opens over the page: the spec pad, the ingredient search, how it keeps, tags, its picture, who can see it. */
export function EditSheets({ edit, selfId, name, sheet, onSheet, pad, onPad, swap, onSwap, spiritTags }: EditSheetsProps) {
  const router = useRouter();
  const { editor, prep, setPrep } = edit;
  const { form, set } = editor;
  const lines = form.recipeItems;
  const setLine = (i: number, u: Partial<(typeof lines)[number]>) => editor.setRecipeItems((prev) => prev.map((l, j) => (j === i ? { ...l, ...u } : l)));
  const close = () => (onSheet(null), onSwap(null));
  const finding = sheet === 'line' || sheet === 'kind' || swap !== null;

  // A name nothing matches opens the add-ingredient wizard; the new one comes back onto this recipe.
  const makeNew = async (n: string) => {
    close();
    // A draft saves first, so coming back doesn't lose its recipe.
    if ('saveAsDraft' in editor && !(await editor.saveAsDraft(true))) return;
    router.push({ pathname: '/add-ingredient', params: { name: n, barId: form.barId || '', attachTo: selfId } });
  };

  return (
    <>
      {pad !== null && lines[pad] ? (
        <SpecPad key={pad} line={lines[pad]} index={pad} count={lines.length} nextName={lines[pad + 1]?.name ?? null} onChange={(u) => setLine(pad, u)} onNext={() => onPad(pad + 1 < lines.length ? pad + 1 : null)} onSwap={() => (onSwap(pad), onPad(null))} onClose={() => onPad(null)} />
      ) : null}
      {finding ? (
        <FindSheet
          title={sheet === 'kind' ? 'What it’s a kind of' : swap !== null ? `Swap ${lines[swap]?.name ?? 'it'} for…` : 'Add an ingredient'}
          ingredients={sheet === 'kind' ? (editor.dropdowns?.ingredients ?? []) : editor.catalog}
          aliases={editor.dropdowns?.ingredientAliases}
          loading={!editor.dropdowns?.ingredients}
          excludeId={selfId}
          allowNew={sheet !== 'kind'}
          onClear={sheet === 'kind' && form.generic ? () => (close(), set({ generic: null })) : undefined}
          onClose={close}
          onNew={(n) => void makeNew(n)}
          onPick={(p) => {
            const at = swap;
            close();
            if (sheet === 'kind') return set({ generic: p });
            if (at !== null) return setLine(at, { ingredient_id: p.id, name: p.name });
            // A new line goes straight to its amount.
            editor.setRecipeItems((prev) => [...prev, { ingredient_id: p.id, name: p.name, amount: '', unit: getPreferredUnit(), preparation_notes: '', is_optional: false }]);
            onPad(lines.length);
          }}
        />
      ) : null}
      {prep && (sheet === 'makes' || sheet === 'keeps' || sheet === 'store' || sheet === 'takes' || sheet === 'how') ? <KeepsSheet field={sheet} fields={prep} set={setPrep} onClose={close} /> : null}
      {sheet === 'tags' ? <TagsSheet tags={spiritTags} selected={form.selectedCategories} onToggle={(id) => set({ selectedCategories: form.selectedCategories.includes(id) ? form.selectedCategories.filter((c) => c !== id) : [...form.selectedCategories, id] })} onClose={close} /> : null}
      {sheet === 'photos' && editor.canChoosePicture ? <PictureSheet itemId={selfId} name={name} value={{ picture: form.picture, photo: form.photo }} onDone={(c) => set(c)} onClose={close} /> : null}
      {sheet === 'access' ? <AccessSheet form={form} set={set} onClose={close} /> : null}
    </>
  );
}
