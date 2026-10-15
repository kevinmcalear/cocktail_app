import { useCocktailDraftEditor } from '@/hooks/useCocktailDraftEditor';

import { EditBrand, EditPage } from './DrinkEditScreen';

/**
 * A draft saved by the older editor (New > Drafts), on the same edit-in-place
 * page as a saved drink. It keeps saving to drafts as you go; Done keeps it a
 * draft, and More > Publish drink makes it a drink.
 */
export function DraftEditScreen({ draftId, barId, initialName, onExit }: { draftId: string; barId?: string | null; initialName?: string | null; onExit: () => void }) {
  const editor = useCocktailDraftEditor({ draftId, barId, initialName });
  return (
    <EditBrand barId={editor.barId}>
      <EditPage editor={editor} id={null} onExit={onExit} />
    </EditBrand>
  );
}
