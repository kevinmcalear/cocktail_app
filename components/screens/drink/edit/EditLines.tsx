import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Caption, Headline, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { orderByPart, type DraftPart } from '@/lib/drinkParts';
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
  /** A drink made in parts (drink-edit-parts): its parts, a part's heading, and Add a part under the last. Null is one part. */
  parts?: DraftPart[] | null;
  onParts?: (parts: DraftPart[]) => void;
  partHead?: (part: number) => ReactNode;
  footer?: ReactNode;
}

/**
 * A recipe's lines while editing it (drink-edit-phone, ingredient-edit-proposal):
 * the making flow's own list, the one New uses (IngredientsStep), over the
 * editor's rows. In a drink, holding one line over another combines them and
 * opens the House-made steps; a line made here saves the way New saves it
 * (hooks/specLineSave).
 */
export function EditLines({ items, onChange, name, ingredients, aliases, coreIds, loading, backBar, bar, forDrink = true, title = 'Spec', aside, note, focus, parts, onParts, partHead, footer }: EditLinesProps) {
  const ds = useDs();
  const parted = parts && parts.length > 1 && partHead ? parts : null;
  const draft: WizardDraft = { ...EMPTY_DRAFT, name, lines: items.map(toLine), parts: parted };
  // The step changes only its lines here, and in parts which part a line is in; anything else it could set (a classic to start from) is New's. The lines stay in part order.
  const set = (change: Partial<WizardDraft>) => {
    if (change.parts && onParts) onParts(change.parts);
    if (change.lines) onChange(orderByPart(change.parts ?? parted, (change.lines as EditLine[]).map(fromLine)));
  };
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Headline role="heading">{title}</Headline>
        {parted ? (
          <View style={[styles.pill, { backgroundColor: ds.c.raised }]}>
            <Caption>{`${parted.length} parts`}</Caption>
          </View>
        ) : aside ? (
          <Caption tone="muted">{aside}</Caption>
        ) : null}
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
        partHead={parted ? partHead : undefined}
      />
      {parted ? footer : null}
      {parted ? <Caption tone="muted">{`Hold a line${Platform.OS === 'web' ? ' by its grip' : ''} and move it into another part. Over a line, it combines.`}</Caption> : null}
      {note ? <Caption tone="muted">{note}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3, alignSelf: 'center' },
});
