import { StyleSheet, View } from 'react-native';

import { Caption, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { fromLine, toLine, type EditLine, type SortableRecipeItem } from '@/lib/recipeItem';

import { IngredientsStep } from '../../addDrink/IngredientsStep';
import type { CatalogIngredient } from '../../addDrink/IngredientSearch';

interface EditLinesProps {
  items: SortableRecipeItem[];
  onChange: (items: SortableRecipeItem[]) => void;
  /** The drink or recipe being edited: what a line combined or made in-house here is made for. */
  name: string;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
  loading?: boolean;
  /** At a venue: its back bar, so its bottles lead the search. */
  backBar?: ReadonlySet<string>;
  /** The venue it belongs to, whose Kit a recipe made here is checked against; null at home. */
  bar: { id: string; name: string } | null;
  /** A drink's spec: lines combine and are made in-house. Off for an ingredient's recipe, which reorders only (as in New). */
  forDrink?: boolean;
  title?: string;
  /** Beside the heading: what a batch makes. */
  aside?: string | null;
  /** Under the lines: "The 3 drinks that use it update when you press Done." */
  note?: string | null;
  /** Bumped by the bottom bar's Line: the cursor goes to the search. */
  focus?: number;
}

/**
 * A recipe's lines while editing it (drink-edit-phone, ingredient-edit-proposal):
 * the making flow's own list, the one New uses (IngredientsStep), over the
 * editor's rows. In a drink, holding one line over another combines them and
 * opens the House-made steps; a line made here saves the way New saves it
 * (hooks/specLineSave).
 */
export function EditLines({ items, onChange, name, ingredients, aliases, coreIds, loading, backBar, bar, forDrink = true, title = 'Spec', aside, note, focus }: EditLinesProps) {
  const draft: WizardDraft = { ...EMPTY_DRAFT, name, lines: items.map(toLine) };
  // The step changes only its lines here; anything else it could set (a classic to start from) is New's.
  const set = (change: Partial<WizardDraft>) => change.lines && onChange((change.lines as EditLine[]).map(fromLine));
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">{title}</Headline>
        {aside ? <Caption tone="muted">{aside}</Caption> : null}
      </View>
      <IngredientsStep
        draft={draft}
        set={set}
        ingredients={ingredients}
        aliases={aliases}
        coreIds={coreIds}
        loading={loading}
        backBar={backBar}
        forDrink={forDrink}
        balance={false}
        editing
        bar={bar}
        trail={[{ label: name }]}
        focus={focus}
      />
      {note ? <Caption tone="muted">{note}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
});
