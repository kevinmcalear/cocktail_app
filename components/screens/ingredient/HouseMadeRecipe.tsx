import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Caption, DsText, SpecRow, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { PrepStep } from '@/hooks/usePrepCard';
import type { BatchSize } from '@/lib/prepParts';
import { sourceSite } from '@/lib/prepMath';
import { prepStepGroups } from '@/lib/prepSteps';
import { scaleRecipe, type RecipeLine } from '@/lib/scale';
import { useSpecView } from '@/hooks/useSpecView';

import { SpecControls } from '../drink/spec/SpecControls';
import { GroupHead } from '../drink/spec/SpecCard';

export interface PrepLine extends RecipeLine {
  ingredientId: string | null;
  note: string | null;
  optional: boolean;
  houseMade: boolean;
}

interface HouseMadeRecipeProps {
  /** This house-made: a house-made inside it opens with Back named for it (`?from=`). */
  itemId: string;
  lines: PrepLine[];
  steps: PrepStep[];
  /** The Makes menu (lib/prepParts batchSizes) and the one picked; it also sets what Log batch logs. */
  sizes: BatchSize[];
  size: BatchSize;
  onSize: (key: string) => void;
  /** Make mode at the size picked (steps, timers, what it really made), or "From what I have…", scaled from one line. */
  onMake: (mode?: 'have') => void;
  /** The pages a shared recipe's ratio was checked on. */
  checkedOn?: string[];
}

/**
 * A house-made's recipe (boards Item-page, Desk-page, And-page, house-made
 * creator): the drink page's Ingredients | Steps and Makes pill, the lines
 * scaled to the size picked, and in Steps each step's name, its timer, its
 * lines and its words. A line that's house-made itself opens its own page.
 * Scaling never changes the saved recipe.
 */
export function HouseMadeRecipe({ itemId, lines, steps, sizes, size, onSize, onMake, checkedOn = [] }: HouseMadeRecipeProps) {
  const router = useRouter();
  const [view, setView] = useSpecView(true);
  const scaled = scaleRecipe(lines, size.factor);
  const indexed = lines.map((l, i) => ({ ...l, i }));
  const measured = scaled.some((l) => l.scaled);

  const row = (l: PrepLine & { i: number }) => {
    const nested = l.houseMade && !!l.ingredientId;
    return (
      <SpecRow
        key={l.id}
        amount={scaled[l.i].scaled}
        alignAmount={measured}
        dense
        ingredient={l.name}
        ingredientId={l.ingredientId}
        houseMade={l.houseMade}
        optional={l.optional}
        note={l.note ?? undefined}
        chevron={nested}
        onPress={l.ingredientId ? () => router.push((nested ? `/ingredient/${l.ingredientId}?from=${itemId}` : `/ingredient/${l.ingredientId}`) as never) : undefined}
      />
    );
  };

  return (
    <View style={styles.card}>
      {lines.length ? (
        <SpecControls
          view={view}
          onView={setView}
          makes={size.makes}
          sizes={sizes.map((s) => ({ key: s.key, label: `Makes ${s.makes}` }))}
          picked={size.key}
          onPick={onSize}
          more={[
            { label: 'Make it step by step…', onPress: () => onMake() },
            { label: 'From what I have…', onPress: () => onMake('have') },
          ]}
        />
      ) : null}
      {view === 'steps' || !lines.length ? (
        <View style={styles.groups}>
          {prepStepGroups(indexed, steps).map((g) => (
            <View key={g.key}>
              {g.title ? <GroupHead number={g.number} title={g.title} aside={g.aside} /> : null}
              {g.lines.map(row)}
              {g.note ? (
                <DsText variant="label" tone="muted" style={styles.note}>
                  {g.note}
                </DsText>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View>{indexed.map(row)}</View>
      )}
      {checkedOn.length ? (
        <View style={styles.sources}>
          <Caption tone="muted">Recipe checked on</Caption>
          {checkedOn.map((url) => (
            <TextLink key={url} label={sourceSite(url)} accessibilityHint="Opens the page the recipe was checked on" onPress={() => void Linking.openURL(url)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  groups: { gap: space.lg },
  note: { paddingTop: space.sm },
  sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md },
});
