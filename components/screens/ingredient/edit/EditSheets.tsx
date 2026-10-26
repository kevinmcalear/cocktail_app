import type { MoreChoice } from '../../drink/edit/EditParts';
import { AccessSheet, FindSheet, TagsSheet } from '../IngredientEditSheets';
import { PictureSheet } from '../PictureSheet';
import type { BodySheet } from './EditBody';
import { KeepsSheet } from './PrepSections';
import type { IngredientEdit } from './useIngredientEdit';

interface EditSheetsProps {
  edit: IngredientEdit;
  /** The saved ingredient's id, or the draft's. */
  selfId: string;
  name: string;
  sheet: MoreChoice | BodySheet | 'more' | null;
  onSheet: (s: null) => void;
  spiritTags: { id: string; name: string }[];
}

/** What the editor opens over the page: what it's a kind of, how it keeps, tags, its picture, who can see it. Its recipe's lines are edited in place (EditLines). */
export function EditSheets({ edit, selfId, name, sheet, onSheet, spiritTags }: EditSheetsProps) {
  const { editor, prep, setPrep } = edit;
  const { form, set } = editor;
  const close = () => onSheet(null);

  return (
    <>
      {sheet === 'kind' ? (
        <FindSheet
          title="What it’s a kind of"
          ingredients={editor.dropdowns?.ingredients ?? []}
          aliases={editor.dropdowns?.ingredientAliases}
          loading={!editor.dropdowns?.ingredients}
          excludeId={selfId}
          allowNew={false}
          onClear={form.generic ? () => (close(), set({ generic: null })) : undefined}
          onClose={close}
          onPick={(p) => (close(), set({ generic: p }))}
        />
      ) : null}
      {prep && (sheet === 'makes' || sheet === 'keeps' || sheet === 'store' || sheet === 'takes' || sheet === 'how') ? <KeepsSheet field={sheet} fields={prep} set={setPrep} onClose={close} /> : null}
      {sheet === 'tags' ? <TagsSheet tags={spiritTags} selected={form.selectedCategories} onToggle={(id) => set({ selectedCategories: form.selectedCategories.includes(id) ? form.selectedCategories.filter((c) => c !== id) : [...form.selectedCategories, id] })} onClose={close} /> : null}
      {sheet === 'photos' && editor.canChoosePicture ? <PictureSheet itemId={selfId} name={name} value={{ picture: form.picture, photo: form.photo }} onDone={(c) => set(c)} onClose={close} /> : null}
      {sheet === 'access' ? <AccessSheet form={form} set={set} onClose={close} /> : null}
    </>
  );
}
